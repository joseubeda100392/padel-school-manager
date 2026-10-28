import { createClient, getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatTime, getScheduleDateTimeInMadrid } from '@/lib/utils'
import { WAITLIST_MAX, isWaitlistable } from '@/lib/waitlist'
import { SpotsClient, type WaitlistData } from './spots-client'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { DEFAULT_FEATURES, parseClubFeatures } from '@/lib/get-club-features'
import { getHolidaySet } from '@/lib/club-holidays'
import { canTakeSpot, parseLowerLevelMap } from '@/lib/spot-levels'
import { getMonthOccurrences, loadStudentSpots } from '@/lib/student-spots'

type Attendee = { name: string; level: string | null }

// "Lucía Martín García" → "Lucía M."
function shortName(full: string | null): string {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Alumno'
  return parts.length > 1 ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : parts[0]
}
const TZ = 'Europe/Madrid'

export default async function StudentSpotsPage({ searchParams }: { searchParams: { month?: string } }) {
  const supabase = createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

  // Mes que se está viendo — por defecto el actual. La navegación no puede
  // pasar de la misma ventana de antelación que ya limita el registro de
  // faltas (Configuración → "Antelación para registrar falta"), porque más
  // allá no hay datos por diseño.
  const [todayYear, todayMonth0] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1]
  const parsedMonth = searchParams.month ? new Date(searchParams.month + '-01') : null
  const year = parsedMonth && !isNaN(parsedMonth.getTime()) ? parsedMonth.getFullYear() : todayYear
  const month0 = parsedMonth && !isNaN(parsedMonth.getTime()) ? parsedMonth.getMonth() : todayMonth0

  const monthStart = `${year}-${String(month0 + 1).padStart(2, '0')}-01`
  const monthEnd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(year, month0 + 1, 0, 12))
  const rangeStart = monthStart > today ? monthStart : today

  const [{ data: userRow }, { data: myEnrollments }, { data: bag }, { data: mySpotBookings }] = await Promise.all([
    admin
      .from('users')
      .select('current_level_id, club_id, is_external, club:clubs(features, config)')
      .eq('id', user.id)
      .single(),
    admin
      .from('group_enrollments')
      .select('schedule_id')
      .eq('student_id', user.id)
      .eq('status', 'active'),
    admin.from('class_bag').select('balance_60, balance_90').eq('user_id', user.id).single(),
    admin
      .from('bookings')
      .select('schedule_id, class_date')
      .eq('student_id', user.id)
      .eq('status', 'confirmed')
      .not('class_date', 'is', null),
  ])
  const myLevelId: string | null = userRow?.current_level_id ?? null
  const myClubId: string | null = (userRow as any)?.club_id ?? null
  // Alumno externo: no ve los huecos libres de las clases fijas de la
  // escuela — el enlace ya se oculta en el menú, esto cubre entrar por URL.
  if ((userRow as any)?.is_external === true) redirect('/student')

  const features = myClubId ? parseClubFeatures((userRow as any)?.club?.features) : DEFAULT_FEATURES
  const clubRow = myClubId ? { config: (userRow as any)?.club?.config ?? null } : null
  if (!features.enable_spots) redirect('/student')

  const holidaySet = getHolidaySet((clubRow as any)?.config)
  // Niveles en los que puede recuperar: el suyo y, si el club lo permite, el
  // que tenga asignado su nivel (Configuración → Clases de recuperación).
  const lowerLevels = parseLowerLevelMap((clubRow as any)?.config)
  const billingStartDate: string | null = (clubRow as any)?.config?.billing_start_date ?? null
  const billingActive = !billingStartDate || today >= billingStartDate

  const advanceMonthsConfig = (clubRow as any)?.config?.falta_advance_months ?? 0
  const effectiveAdvanceMonths = advanceMonthsConfig > 0 ? advanceMonthsConfig : 2
  const maxDateObj = new Date(todayYear, todayMonth0 + effectiveAdvanceMonths, 1)
  const maxYear = maxDateObj.getFullYear()
  const maxMonth0 = maxDateObj.getMonth()

  const myScheduleIds = new Set((myEnrollments ?? []).map(e => e.schedule_id))
  const balance60 = bag?.balance_60 ?? 0
  const balance90 = bag?.balance_90 ?? 0

  const {
    absenceSpots: absenceRaw, capacitySpots: capacityRaw, schedulesRaw, schedulesById, occurrencesBySchedule,
    exclusionsForCapacity, bookingsForCapacity, realAttendingCount, reservedByClubOn,
  } = await loadStudentSpots(admin, {
    userId: user.id, myClubId, myLevelId, config: (clubRow as any)?.config, rangeStart, monthEnd, myScheduleIds, mySpotBookings: mySpotBookings ?? [],
  })

  // Quién va a cada clase ese día (opción del club): fijos activos sin falta
  // ese día más reservas puntuales. Solo nombre, inicial del apellido y nivel.
  const showAttendees = (clubRow as any)?.config?.spots_show_attendees === 1
  let attendeesFor: (scheduleId: string, classDate: string) => Attendee[] = () => []
  if (showAttendees) {
    const ids = [...new Set([
      ...(exclusionsForCapacity ?? []).map((e: any) => e.student_id as string),
      ...(bookingsForCapacity ?? []).map((b: any) => b.student_id as string),
    ])].filter(id => id && id !== user.id)
    const [{ data: people }, { data: clubLevels }] = await Promise.all([
      ids.length ? admin.from('users').select('id, name, current_level_id').in('id', ids) : Promise.resolve({ data: [] as any[] }),
      admin.from('levels').select('id, name').eq('club_id', myClubId ?? ''),
    ])
    const levelName = new Map((clubLevels ?? []).map((l: any) => [l.id, l.name as string]))
    const byId = new Map((people ?? []).map((p: any) => [p.id, { name: shortName(p.name), level: levelName.get(p.current_level_id) ?? null }]))
    attendeesFor = (scheduleId, classDate) => {
      const fixed = (exclusionsForCapacity ?? [])
        .filter((e: any) => e.schedule_id === scheduleId
          && (!e.start_date || e.start_date <= classDate) && (!e.end_date || e.end_date >= classDate)
          && !(e.schedule_exclusions ?? []).some((x: any) => x.excluded_date === classDate))
        .map((e: any) => e.student_id)
      const booked = (bookingsForCapacity ?? []).filter((b: any) => b.schedule_id === scheduleId && b.class_date === classDate).map((b: any) => b.student_id)
      return [...fixed, ...booked].map(id => byId.get(id)).filter((a): a is Attendee => !!a)
    }
  }

  const absenceSpots = absenceRaw.map(spot => ({ ...spot, attendees: attendeesFor(spot.scheduleId, spot.excludedDate) }))
  const capacitySpots = capacityRaw.map(spot => ({ ...spot, attendees: attendeesFor(spot.scheduleId, spot.excludedDate) }))

  const allSpots = [...absenceSpots, ...capacitySpots]

  // Reservas en espera: clases llenas de su nivel en las que alguien ocupa
  // una plaza puntual (la que puede volver a quedar libre), y las reservas en
  // las que ya está. Si la tabla aún no existe o falla, la sección no sale.
  let waitlist: WaitlistData | null = null
  if (features.enable_waitlist) {
    const nowMs = Date.now()
    const fullClasses: WaitlistData['full'] = []
    for (const s of schedulesRaw ?? []) {
      if (s.type === 'intensivo' || (s as any).is_private || myScheduleIds.has(s.id)) continue
      const levelId = (s.level as any)?.id ?? null
      if (!canTakeSpot(myLevelId, levelId, lowerLevels)) continue
      const active = ((s.enrollments ?? []) as any[]).filter((e: any) => e.status === 'active')
      for (const classDate of occurrencesBySchedule[s.id] ?? getMonthOccurrences(s, rangeStart, monthEnd, holidaySet)) {
        if (getScheduleDateTimeInMadrid(s.start_time, classDate).getTime() <= nowMs) continue
        if ((mySpotBookings ?? []).some(b => b.schedule_id === s.id && b.class_date === classDate)) continue
        const bookedCount = (bookingsForCapacity ?? []).filter((b: any) => b.schedule_id === s.id && b.class_date === classDate).length
        const occupied = realAttendingCount(s.id, active, classDate)
        if (!isWaitlistable({ capacity: s.max_students, presentFixed: occupied - bookedCount, bookedCount, reservedByClub: reservedByClubOn(s.id, classDate) })) continue
        const startDt = new Date(s.start_time)
        const endDt = new Date(s.end_time)
        fullClasses.push({
          scheduleId: s.id,
          date: classDate,
          startTime: formatTime(startDt),
          endTime: formatTime(endDt),
          durationMin: Math.round((endDt.getTime() - startDt.getTime()) / 60000),
          courtName: (s.court as any)?.name ?? '—',
          coachName: (s.coach as any)?.name ?? null,
          level: (s.level as any) ?? null,
          maxStudents: s.max_students,
          waitingCount: 0,
          attendees: attendeesFor(s.id, classDate),
        })
      }
    }

    const { data: myWaiting, error: myWaitingErr } = await admin
      .from('class_waitlist')
      .select('id, schedule_id, class_date')
      .eq('student_id', user.id)
      .eq('status', 'waiting')
      .gte('class_date', today)
      .order('class_date')
    const scheduleIdsForQueues = [...new Set([...fullClasses.map(f => f.scheduleId), ...(myWaiting ?? []).map(w => w.schedule_id)])]
    const { data: queues, error: queuesErr } = scheduleIdsForQueues.length
      ? await admin.from('class_waitlist').select('id, schedule_id, class_date, student_id')
          .in('schedule_id', scheduleIdsForQueues).eq('status', 'waiting').gte('class_date', today).order('created_at')
      : { data: [], error: null }

    if (!myWaitingErr && !queuesErr) {
      const queueOf = (scheduleId: string, date: string) => (queues ?? []).filter((q: any) => q.schedule_id === scheduleId && q.class_date === date)
      for (const f of fullClasses) {
        const q = queueOf(f.scheduleId, f.date)
        f.waitingCount = q.length
        const mine = q.findIndex((x: any) => x.student_id === user.id)
        if (mine >= 0) { f.myEntryId = q[mine].id; f.myPosition = mine + 1 }
      }
      const mineList: WaitlistData['mine'] = (myWaiting ?? []).map((w: any) => {
        const sched = schedulesById[w.schedule_id]
        const startDt = new Date(sched?.start_time)
        const endDt = new Date(sched?.end_time)
        return {
          id: w.id,
          date: w.class_date,
          startTime: sched ? formatTime(startDt) : '',
          endTime: sched ? formatTime(endDt) : '',
          courtName: (sched?.court as any)?.name ?? '—',
          position: queueOf(w.schedule_id, w.class_date).findIndex((x: any) => x.id === w.id) + 1,
        }
      })
      waitlist = { full: fullClasses, mine: mineList, max: WAITLIST_MAX }
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <RealtimeRefresh
        channelName={`student-spots-${user.id}`}
        subs={[
          { table: 'schedule_exclusions' },
          // Antes solo escuchaba las reservas del propio alumno — si el
          // admin metía a OTRO alumno y llenaba la clase, esta pantalla
          // (si ya estaba abierta) no se enteraba y seguía mostrando el
          // hueco como libre hasta recargar a mano. Con el club entero
          // sí se entera de cualquier reserva que cambie el aforo.
          { table: 'bookings', filter: myClubId ? `club_id=eq.${myClubId}` : undefined },
        ]}
      />
      <header>
        <h1 className="font-display text-title text-ink sm:text-display">Huecos libres</h1>
        <p className="mt-1 text-body text-ink-2">Plazas libres de tu nivel para recuperar una falta o jugar más.</p>
      </header>

      <SpotsClient
        spots={allSpots}
        balance60={balance60}
        balance90={balance90}
        enablePayments={features.enable_payments && billingActive}
        enable60min={features.enable_60min}
        enable90min={features.enable_90min}
        cashOnly={features.cash_only_payments}
        payPerClassPrice60={(clubRow as any)?.config?.pay_per_class_price_60 ?? 1200}
        payPerClassPrice90={(clubRow as any)?.config?.pay_per_class_price_90 ?? 1500}
        wholeClassPrice60={(clubRow as any)?.config?.whole_class_price_60 ?? 4800}
        wholeClassPrice90={(clubRow as any)?.config?.whole_class_price_90 ?? 6000}
        year={year}
        month0={month0}
        todayStr={today}
        maxYear={maxYear}
        maxMonth0={maxMonth0}
        waitlist={waitlist}
      />
    </div>
  )
}
