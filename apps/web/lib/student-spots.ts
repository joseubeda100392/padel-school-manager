import type { getAdminClient } from '@/lib/supabase/admin'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import { getHolidaySet } from '@/lib/club-holidays'
import { canTakeSpot, parseLowerLevelMap } from '@/lib/spot-levels'

type Admin = ReturnType<typeof getAdminClient>

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TZ = 'Europe/Madrid'

// Todas las ocurrencias de un horario dentro de [rangeStart, rangeEnd] — a
// diferencia de la versión anterior (solo "la próxima"), esto es lo que
// necesita el calendario de mes: puede haber varias fechas de la misma clase
// visibles a la vez.
export function getMonthOccurrences(s: any, rangeStart: string, rangeEnd: string, holidaySet: Set<string>): string[] {
  if (s.recurrence === 'none') {
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(s.start_time))
    return d >= rangeStart && d <= rangeEnd && !holidaySet.has(d) ? [d] : []
  }

  const scheduleStartDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(s.start_time))
  const effectiveStart = scheduleStartDate > rangeStart ? scheduleStartDate : rangeStart
  const effectiveEnd = s.recurrence_end_date && s.recurrence_end_date < rangeEnd ? s.recurrence_end_date : rangeEnd
  if (effectiveStart > effectiveEnd) return []

  const dow = getDayOfWeek(s.start_time)
  let cursor = new Date(effectiveStart + 'T12:00:00Z')
  while (getDayOfWeek(cursor) !== dow) cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  const endCursor = new Date(effectiveEnd + 'T12:00:00Z')

  const dates: string[] = []
  while (cursor.getTime() <= endCursor.getTime()) {
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(cursor)
    if (!holidaySet.has(dateStr)) dates.push(dateStr)
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
  }
  return dates
}

// Huecos que puede coger un alumno entre rangeStart y rangeEnd: los de faltas
// publicadas y las plazas libres de clases de su nivel. Lo usan la pantalla de
// Huecos y el contador de inicio, para que los dos digan lo mismo.
export async function loadStudentSpots(admin: Admin, {
  userId,
  myClubId,
  myLevelId,
  config,
  rangeStart,
  monthEnd,
  myScheduleIds,
  mySpotBookings,
}: {
  userId: string
  myClubId: string | null
  myLevelId: string | null
  config: any
  rangeStart: string
  monthEnd: string
  myScheduleIds: Set<string>
  mySpotBookings: { schedule_id: string; class_date: string | null }[]
}) {
  const holidaySet = getHolidaySet(config)
  const lowerLevels = parseLowerLevelMap(config)

  const { data: spotsRaw } = await admin
    .from('schedule_exclusions')
    .select(`
      id, excluded_date,
      group_enrollment:group_enrollments!group_enrollment_id(
        schedule_id,
        schedule:schedules!schedule_id(
          id, start_time, end_time, max_students, club_id, type, price_cents,
          court:courts(name),
          level:levels(id, name, color),
          coach:users!schedules_coach_id_fkey(name)
        )
      )
    `)
    .eq('publish_spot', true)
    .gte('excluded_date', rangeStart)
    .lte('excluded_date', monthEnd)
    .order('excluded_date')

  const { data: schedulesRaw } = await admin
    .from('schedules')
    .select(`
      id, start_time, end_time, max_students, recurrence_end_date, type, price_cents, recurrence, intensivo_group_id, is_private,
      court:courts(name),
      level:levels(id, name, color),
      coach:users!schedules_coach_id_fkey(name),
      enrollments:group_enrollments(student_id, status, start_date, end_date)
    `)
    .eq('club_id', myClubId ?? '')
    .eq('is_active', true)

  // Absence spots (existing logic)
  const absenceCandidates = (spotsRaw ?? [])
    .filter(s => {
      const ge = s.group_enrollment as any
      const schedule = ge?.schedule as any
      const levelId = schedule?.level?.id ?? null
      const levelOk = canTakeSpot(myLevelId, levelId, lowerLevels)
      const clubOk = !myClubId || schedule?.club_id === myClubId
      const alreadyBooked = (mySpotBookings ?? []).some(
        b => b.schedule_id === ge?.schedule_id && b.class_date === s.excluded_date
      )
      // Faltas registradas antes de que el admin marcara el día como festivo
      // siguen en BD con publish_spot=true — ese día no hay clase que cubrir.
      if (holidaySet.has(s.excluded_date)) return false
      return ge?.schedule_id && !myScheduleIds.has(ge.schedule_id) && levelOk && clubOk && !alreadyBooked
    })
    .map(s => {
      const ge = s.group_enrollment as any
      const schedule = ge?.schedule
      const startDt = new Date(schedule?.start_time)
      const endDt = new Date(schedule?.end_time)
      return {
        spotType: 'absence' as const,
        exclusionId: s.id,
        excludedDate: s.excluded_date,
        scheduleId: ge?.schedule_id,
        scheduleType: (schedule?.type ?? 'regular') as 'regular' | 'intensivo',
        schedulePriceCents: (schedule?.price_cents as number | null) ?? null,
        dayLabel: DAYS[getDayOfWeek(startDt)],
        startTime: formatTime(startDt),
        endTime: formatTime(endDt),
        durationMin: Math.round((endDt.getTime() - startDt.getTime()) / 60000),
        courtName: schedule?.court?.name ?? '—',
        coachName: schedule?.coach?.name ?? null,
        maxStudents: schedule?.max_students ?? 4,
        level: schedule?.level ?? null,
        enrolledCount: null,
      }
    })

  // Capacity spots: classes with open spots where student is not enrolled —
  // ahora por cada fecha del mes visible, no solo "la próxima".
  const absenceScheduleIds = new Set(absenceCandidates.map(s => s.scheduleId))

  const occurrencesBySchedule: Record<string, string[]> = {}
  for (const s of schedulesRaw ?? []) {
    if (absenceScheduleIds.has(s.id)) continue
    occurrencesBySchedule[s.id] = getMonthOccurrences(s, rangeStart, monthEnd, holidaySet)
  }

  const candidateIds = Object.keys(occurrencesBySchedule).filter(id => occurrencesBySchedule[id].length > 0)
  // Para el recuento real hacen falta también los horarios que tienen algún
  // "hueco por falta" (candidateIds los excluye para no duplicar el tipo de
  // hueco que se genera) — si no, no se puede comprobar si esa falta sigue
  // teniendo de verdad una plaza libre o si ya se cubrió por otro lado.
  const idsForRealCount = [...new Set([...candidateIds, ...absenceScheduleIds])]

  // Conteo real de asistentes de cada fecha: activos del grupo fijo MENOS
  // quien tiene falta registrada justo ese día, MÁS reservas puntuales ya
  // confirmadas para esa fecha — el mismo criterio que usan las funciones de
  // reserva atómica (book_capacity_spot), para no anunciar como libre una
  // plaza que en realidad ya está completa, ni bloquear una que sí está libre.
  const [{ data: exclusionsForCapacity }, { data: bookingsForCapacity }] = await Promise.all([
    idsForRealCount.length
      ? admin.from('group_enrollments').select('id, schedule_id, student_id, start_date, end_date, schedule_exclusions(excluded_date, publish_spot, spot_taken)').in('schedule_id', idsForRealCount).eq('status', 'active')
      : { data: [] },
    idsForRealCount.length
      ? admin.from('bookings').select('schedule_id, class_date, student_id').eq('status', 'confirmed').in('schedule_id', idsForRealCount)
      : { data: [] },
  ])

  // activeEnrollments se filtra por start_date/end_date respecto a
  // classDate — un sustituto con alta futura o una baja ya efectiva ese día
  // no deben contar como ocupando plaza esa fecha concreta.
  function realAttendingCount(scheduleId: string, activeEnrollments: any[], classDate: string): number {
    const activeCount = activeEnrollments.filter((e: any) =>
      (!e.start_date || e.start_date <= classDate) && (!e.end_date || e.end_date >= classDate)
    ).length
    const absentCount = (exclusionsForCapacity ?? []).filter((e: any) =>
      e.schedule_id === scheduleId && (e.schedule_exclusions ?? []).some((x: any) => x.excluded_date === classDate)
    ).length
    const bookedCount = (bookingsForCapacity ?? []).filter((b: any) =>
      b.schedule_id === scheduleId && b.class_date === classDate
    ).length
    return activeCount - absentCount + bookedCount
  }

  // Si el hueco de esa fecha lo abre una falta que el admin marcó como "no
  // publicada" (la está gestionando él a mano, ej. metiendo a alguien
  // concreto), no debe aparecer TAMPOCO por la vía de "capacidad libre" —
  // antes solo se ocultaba de la lista de "ausencias", pero el cálculo
  // numérico de plazas libres lo volvía a sacar igualmente, dejando que
  // cualquiera se apuntara a una plaza que el admin ya había resuelto.
  function reservedByClubOn(scheduleId: string, classDate: string): number {
    return (exclusionsForCapacity ?? []).filter((e: any) =>
      e.schedule_id === scheduleId &&
      (e.schedule_exclusions ?? []).some((x: any) => x.excluded_date === classDate && x.publish_spot === false && x.spot_taken !== true)
    ).length
  }
  function hasUnpublishedOpening(scheduleId: string, classDate: string): boolean {
    return reservedByClubOn(scheduleId, classDate) > 0
  }

  const schedulesById: Record<string, any> = {}
  for (const s of schedulesRaw ?? []) schedulesById[s.id] = s

  // Puede haber más de un alumno del grupo fijo ausente el mismo día —
  // cada falta publicada genera su propia card, y eso está bien mientras
  // sigan quedando plazas de verdad. Pero si ya se rellenaron todas por
  // otra vía (ej. el admin metió a alguien a mano en la OTRA falta), esta
  // card no debe seguir anunciándose solo porque su publish_spot no se
  // haya actualizado — se revalida contra el aforo real, no solo el flag.
  const absenceSpots = absenceCandidates.filter(spot => {
    const active = ((schedulesById[spot.scheduleId]?.enrollments ?? []) as any[]).filter((e: any) => e.status === 'active')
    return realAttendingCount(spot.scheduleId, active, spot.excludedDate) + reservedByClubOn(spot.scheduleId, spot.excludedDate) < spot.maxStudents
  })

  const capacitySpots = candidateIds.flatMap((scheduleId) => {
    const s = schedulesById[scheduleId]
    if (!s || s.type === 'intensivo') return [] // Intensivos are handled in /student/intensivos
    // Una clase particular es una plaza pactada con un alumno concreto — el
    // admin la asigna a mano (ver /api/admin/bookings/spot), nunca debe
    // aparecer aquí como hueco abierto a cualquiera.
    if ((s as any).is_private) return []
    const enrollments = (s.enrollments ?? []) as any[]
    const active = enrollments.filter((e: any) => e.status === 'active')
    const alreadyIn = active.some((e: any) => e.student_id === userId)
    if (alreadyIn) return []
    const levelId = (s.level as any)?.id ?? null
    if (!canTakeSpot(myLevelId, levelId, lowerLevels)) return []

    const startDt = new Date(s.start_time)
    const endDt = new Date(s.end_time)

    return occurrencesBySchedule[scheduleId]
      .filter((classDate) => {
        const alreadyBooked = (mySpotBookings ?? []).some(b => b.schedule_id === scheduleId && b.class_date === classDate)
        const realCount = realAttendingCount(scheduleId, active, classDate)
        return realCount < s.max_students && !alreadyBooked && !hasUnpublishedOpening(scheduleId, classDate)
      })
      .map((classDate) => ({
        spotType: 'capacity' as const,
        exclusionId: null,
        excludedDate: classDate,
        scheduleId,
        scheduleType: (s.type ?? 'regular') as 'regular' | 'intensivo',
        schedulePriceCents: (s.price_cents as number | null) ?? null,
        dayLabel: DAYS[getDayOfWeek(startDt)],
        startTime: formatTime(startDt),
        endTime: formatTime(endDt),
        durationMin: Math.round((endDt.getTime() - startDt.getTime()) / 60000),
        courtName: (s.court as any)?.name ?? '—',
        coachName: (s.coach as any)?.name ?? null,
        maxStudents: s.max_students,
        level: s.level as any,
        enrolledCount: realAttendingCount(scheduleId, active, classDate),
      }))
  }).sort((a, b) => a.excludedDate.localeCompare(b.excludedDate))

  return {
    absenceSpots,
    capacitySpots,
    schedulesRaw: schedulesRaw ?? [],
    schedulesById,
    occurrencesBySchedule,
    exclusionsForCapacity: exclusionsForCapacity ?? [],
    bookingsForCapacity: bookingsForCapacity ?? [],
    realAttendingCount,
    reservedByClubOn,
    lowerLevels,
    holidaySet,
  }
}
