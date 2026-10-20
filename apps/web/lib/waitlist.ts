import { getAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push'
import { formatTime, getScheduleDateTimeInMadrid } from '@/lib/utils'
import { getHolidaySet } from '@/lib/club-holidays'

type Admin = ReturnType<typeof getAdminClient>

// Plazas en espera por clase y fecha.
export const WAITLIST_MAX = 2
// Si una plaza se libera tantas veces seguidas en la misma llamada (p. ej. al
// quitar a varios del grupo) no se mete a más de este número de golpe.
const MAX_PROMOTIONS_PER_CALL = 4

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// "martes 20 de octubre a las 19:00 · Pista 2"
export function waitlistClassLabel(startTime: string, classDate: string, courtName?: string | null): string {
  const d = new Date(classDate + 'T12:00:00Z')
  const day = DAY_NAMES[d.getUTCDay()]
  const date = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  const court = courtName ? ` · ${courtName}` : ''
  return `${day} ${date} a las ${formatTime(startTime)}${court}`
}

// Regla del club: solo se puede reservar un día de una clase si está llena y
// al menos una plaza la ocupa una reserva puntual (alguien que cogió un hueco),
// que es la que puede volver a quedar libre. Con hueco libre no hace falta
// reserva: se coge el hueco. Se mira el recuento real, no el aviso de "falta
// publicada", que puede quedarse puesto aunque la plaza ya esté cubierta.
export function isWaitlistable(o: { capacity: number; presentFixed: number; bookedCount: number }): boolean {
  return o.bookedCount >= 1 && o.presentFixed + o.bookedCount >= o.capacity
}

export interface ClassOccupancy {
  capacity: number
  presentFixed: number
  bookedCount: number
  fixedStudentIds: Set<string>
  bookedStudentIds: Set<string>
}

// Quién ocupa la clase ese día: fijos activos en esa fecha que no tienen
// falta, más reservas puntuales no canceladas. Mismo recuento que las
// funciones de reserva de la base de datos.
export async function getClassOccupancy(admin: Admin, scheduleId: string, classDate: string, capacity: number): Promise<ClassOccupancy> {
  const [{ data: enrollments }, { data: bookings }] = await Promise.all([
    admin.from('group_enrollments')
      .select('student_id, start_date, end_date, schedule_exclusions(excluded_date, publish_spot)')
      .eq('schedule_id', scheduleId)
      .eq('status', 'active'),
    admin.from('bookings')
      .select('student_id')
      .eq('schedule_id', scheduleId)
      .eq('class_date', classDate)
      .neq('status', 'cancelled'),
  ])
  const fixedStudentIds = new Set<string>()
  let presentFixed = 0
  for (const e of (enrollments ?? []) as any[]) {
    if ((e.start_date && e.start_date > classDate) || (e.end_date && e.end_date < classDate)) continue
    fixedStudentIds.add(e.student_id)
    const absent = (e.schedule_exclusions ?? []).some((x: any) => x.excluded_date === classDate)
    if (!absent) presentFixed++
  }
  const bookedStudentIds = new Set((bookings ?? []).map((b: any) => b.student_id as string))
  return { capacity, presentFixed, bookedCount: bookings?.length ?? 0, fixedStudentIds, bookedStudentIds }
}

function minutesUtc(iso: string) {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

// Mismo criterio que la reserva de huecos (bookings/spot): se comparan las
// horas de las clases del mismo día.
export function overlaps(a: { start_time: string; end_time: string }, b: { start_time: string; end_time: string }): boolean {
  return minutesUtc(a.start_time) < minutesUtc(b.end_time) && minutesUtc(b.start_time) < minutesUtc(a.end_time)
}

export interface WaitlistResult {
  promoted: string[]
  skipped: string[]
  notifiedLate: boolean
}

// Se llama cada vez que puede haberse liberado una plaza de esa clase ese día
// (cancelación, falta de un fijo, falta publicada, baja del grupo). Si hay
// alguien en reserva y falta más de lo que marca el plazo de cancelación del
// club, entra el primero que pueda; si falta menos, solo se les avisa de que
// hay plaza (meterles sin preguntar a última hora les dejaría sin poder
// cancelar). Nunca lanza: un fallo aquí no debe romper la acción que lo llamó.
export async function processWaitlist(
  admin: Admin,
  scheduleId: string,
  classDate: string,
  { notifyIfLate = true }: { notifyIfLate?: boolean } = {},
): Promise<WaitlistResult> {
  const result: WaitlistResult = { promoted: [], skipped: [], notifiedLate: false }
  try {
    const { data: waiting } = await admin
      .from('class_waitlist')
      .select('id, student_id')
      .eq('schedule_id', scheduleId)
      .eq('class_date', classDate)
      .eq('status', 'waiting')
      .order('created_at')
    if (!waiting?.length) return result

    const { data: schedule } = await admin
      .from('schedules')
      .select('start_time, end_time, club_id, court:courts(name), club:clubs(config, features)')
      .eq('id', scheduleId)
      .single()
    if (!schedule) return result
    const club = (schedule as any).club
    if (club?.features?.enable_waitlist !== true) return result
    if (getHolidaySet(club?.config).has(classDate)) return result

    const label = waitlistClassLabel(schedule.start_time, classDate, (schedule as any).court?.name)
    const classAt = getScheduleDateTimeInMadrid(schedule.start_time, classDate)
    const hoursUntil = (classAt.getTime() - Date.now()) / 3600000
    if (hoursUntil <= 0) return result

    const cancellationHours = club?.config?.cancellation_hours ?? 24
    if (hoursUntil < cancellationHours) {
      if (notifyIfLate) {
        await sendPushToUsers(waiting.map(w => w.student_id), {
          title: '🎾 Plaza libre en tu reserva',
          body: `Se ha liberado una plaza el ${label}. Si quieres ir, cógela en Huecos.`,
          url: '/student/spots',
        }, 'spot_available')
        result.notifiedLate = true
      }
      return result
    }

    for (let i = 0; i < MAX_PROMOTIONS_PER_CALL; i++) {
      const { data: queue } = await admin
        .from('class_waitlist')
        .select('id, student_id')
        .eq('schedule_id', scheduleId)
        .eq('class_date', classDate)
        .eq('status', 'waiting')
        .order('created_at')
      if (!queue?.length) break

      const conflicted = await studentsWithClashingClass(admin, queue.map(q => q.student_id), scheduleId, classDate, schedule)
      const candidates = queue.filter(q => !conflicted.has(q.student_id))
      for (const q of queue.filter(q => conflicted.has(q.student_id))) {
        await admin.from('class_waitlist')
          .update({ status: 'skipped', skip_reason: 'Ya tienes otra clase a esa hora', updated_at: new Date().toISOString() })
          .eq('id', q.id).eq('status', 'waiting')
        await notifySkipped(q.student_id, label, 'ya tienes otra clase a esa hora')
        result.skipped.push(q.student_id)
      }
      if (!candidates.length) break

      const { data: rpc, error } = await admin.rpc('promote_class_waitlist', {
        p_schedule_id: scheduleId,
        p_class_date: classDate,
        p_candidate_ids: candidates.map(c => c.id),
      })
      if (error || !rpc) {
        console.error('[waitlist] promote failed:', error?.message)
        break
      }
      for (const s of (rpc.skipped ?? []) as { student_id: string; reason: string }[]) {
        const noBag = /bolsa|bonos/i.test(s.reason ?? '')
        await notifySkipped(s.student_id, label, noBag ? 'no te quedan clases en la bolsa' : (s.reason ?? '').toLowerCase())
        result.skipped.push(s.student_id)
      }
      if (!rpc.promoted) break

      result.promoted.push(rpc.student_id)
      await sendPushToUsers([rpc.student_id], {
        title: '🎾 ¡Has entrado en la clase!',
        body: `Se liberó la plaza y era tuya: ${label}. Se ha descontado 1 clase de tu bolsa.`,
        url: '/student',
      }, 'booking_confirmed')
    }
  } catch (err) {
    console.error('[waitlist] processWaitlist error:', err instanceof Error ? err.message : err)
  }
  return result
}

async function notifySkipped(studentId: string, label: string, why: string) {
  await sendPushToUsers([studentId], {
    title: 'No hemos podido darte la plaza',
    body: `Se liberó la clase del ${label}, pero ${why}. Ya no estás en la reserva.`,
    url: '/student/spots',
  }, 'booking_cancelled')
}

async function studentsWithClashingClass(
  admin: Admin,
  studentIds: string[],
  scheduleId: string,
  classDate: string,
  schedule: { start_time: string; end_time: string },
): Promise<Set<string>> {
  const { data } = await admin
    .from('bookings')
    .select('student_id, schedules(start_time, end_time)')
    .in('student_id', studentIds)
    .eq('class_date', classDate)
    .neq('status', 'cancelled')
    .neq('schedule_id', scheduleId)
  const clash = new Set<string>()
  for (const b of data ?? []) {
    const s = (b as any).schedules
    if (s && overlaps(schedule, s)) clash.add((b as any).student_id)
  }
  return clash
}

// Una baja del grupo libera plaza en todas sus fechas futuras: se revisa cada
// fecha que tenga gente en reserva.
export async function processWaitlistForSchedule(admin: Admin, scheduleId: string): Promise<void> {
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
    const { data } = await admin
      .from('class_waitlist')
      .select('class_date')
      .eq('schedule_id', scheduleId)
      .eq('status', 'waiting')
      .gte('class_date', today)
    const dates = [...new Set((data ?? []).map(d => d.class_date as string))]
    for (const date of dates) await processWaitlist(admin, scheduleId, date)
  } catch (err) {
    console.error('[waitlist] processWaitlistForSchedule error:', err instanceof Error ? err.message : err)
  }
}
