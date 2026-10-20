import { createClient, getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatCurrency, getDayOfWeek, matchesDayTimePreference } from '@/lib/utils'
import Link from 'next/link'
import { CalendarDays, ChevronRight, CircleAlert, CircleCheck, Clock, Package, UserPlus } from 'lucide-react'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { DEFAULT_FEATURES, parseClubFeatures } from '@/lib/get-club-features'
import { getHolidaySet } from '@/lib/club-holidays'
import { getNextOccurrence } from '@/lib/next-class'
import { lastDayOfMonthStr } from '@/lib/billing-cycle'
import { formatClock, formatLongDate } from '@/lib/format-date'
import { CourtCard } from '@/components/ui/court-card'
import { Card } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { EmptyState, Notice } from '@/components/ui/feedback'
import { buttonVariants } from '@/components/ui/button'
import { PistaVivaOptin } from './pista-viva-optin'
import { HomeBand } from '@/components/ui/home-band'
import { ProgressCard, type ProgressChecklist } from './progress-card'

function isPaidThisMonth(paidUntil: string | null) {
  if (!paidUntil) return false
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  const [y, m] = todaySpain.split('-').map(Number)
  return paidUntil >= lastDayOfMonthStr(y, m - 1)
}

export default async function StudentHomePage() {
  const supabase = createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const TZ = 'Europe/Madrid'
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())

  // Dos tandas en paralelo en vez de siete consultas en fila: la primera solo
  // necesita el id del alumno; la segunda, el club, el nivel y sus grupos.
  const [{ data: userData }, { data: bag }, { data: enrollments }, { data: spots }, { data: mySpotBookings }, { data: allChecklists }] = await Promise.all([
    admin
      .from('users')
      .select('name, email, current_level_id, club_id, pista_viva_optin, playtomic_level, pista_viva_preferred_days, pista_viva_preferred_start, pista_viva_preferred_end, club:clubs(features, config)')
      .eq('id', user.id)
      .single(),
    admin.from('class_bag').select('balance_60, balance_90').eq('user_id', user.id).single(),
    admin
      .from('group_enrollments')
      .select('id, monthly_price, paid_until, start_date, schedule:schedules(id, start_time, end_time, court:courts(name))')
      .eq('student_id', user.id)
      .eq('status', 'active'),
    admin
      .from('schedule_exclusions')
      .select('id, excluded_date, group_enrollment:group_enrollments!group_enrollment_id(schedule_id, schedule:schedules!schedule_id(club_id, level_id))')
      .eq('publish_spot', true)
      .gte('excluded_date', today),
    admin.from('bookings').select('schedule_id, class_date').eq('student_id', user.id).eq('status', 'confirmed').not('class_date', 'is', null),
    admin
      .from('student_checklists')
      .select('id, title, created_at, completed_at, items:checklist_items(id, text, sort_order, completed_at)')
      .eq('student_id', user.id),
  ])

  const clubId = (userData as any)?.club_id as string | undefined
  const clubRow = (userData as any)?.club ?? null
  const features = clubId ? parseClubFeatures(clubRow?.features) : DEFAULT_FEATURES
  const checklists = features.enable_objectives ? allChecklists : []
  const myPistaVivaLevel = (userData as any)?.playtomic_level as number | null
  const myPreferredDays = (userData as any)?.pista_viva_preferred_days as number[] | null
  const myPreferredStart = (userData as any)?.pista_viva_preferred_start as string | null
  const myPreferredEnd = (userData as any)?.pista_viva_preferred_end as string | null
  const myLevelId = (userData as any)?.current_level_id ?? null
  const activeEnrollments = enrollments ?? []
  const enrolledScheduleIds = activeEnrollments.map((e: any) => (e.schedule as any)?.id).filter(Boolean)

  const [{ data: capacitySchedules }, { data: pistaVivaMatches }, { data: levelData }, { data: timeOverrides }] = await Promise.all([
    clubId
      ? admin.from('schedules').select('id, max_students, type, recurrence, recurrence_end_date, start_time, level:levels(id), enrollments:group_enrollments(student_id, status)').eq('club_id', clubId).neq('type', 'intensivo')
      : Promise.resolve({ data: [] }),
    features.enable_pista_viva && clubId && myPistaVivaLevel != null
      ? admin
          .from('pista_viva_open_match_alerts')
          .select('playtomic_match_id, court_name, slot_datetime, level_min, level_max')
          .eq('club_id', clubId)
          .eq('status', 'sent')
          .lte('level_min', myPistaVivaLevel)
          .gte('level_max', myPistaVivaLevel)
          .gt('slot_datetime', new Date().toISOString())
          .order('slot_datetime', { ascending: true })
      : Promise.resolve({ data: [] }),
    myLevelId
      ? admin.from('levels').select('name, color').eq('id', myLevelId).single()
      : Promise.resolve({ data: null }),
    enrolledScheduleIds.length
      ? admin
          .from('schedule_time_overrides')
          .select('schedule_id, override_date, new_start_time, new_end_time')
          .in('schedule_id', enrolledScheduleIds)
          .gte('override_date', todaySpain)
      : Promise.resolve({ data: [] }),
  ])

  const visiblePistaVivaMatches = (pistaVivaMatches ?? []).filter((m: any) =>
    matchesDayTimePreference(new Date(m.slot_datetime), myPreferredDays, myPreferredStart, myPreferredEnd),
  )

  const billingStartDate: string | null = clubRow?.config?.billing_start_date ?? null
  const billingActive = !billingStartDate || todaySpain >= billingStartDate

  const bagBalance = (bag?.balance_60 ?? 0) + (bag?.balance_90 ?? 0)
  // No contar como "pendiente" una inscripción cuya facturación todavía no
  // ha arrancado (start_date en el futuro) — si no, un alumno recién
  // matriculado para una clase que aún no ha dado ni una sesión vería un
  // aviso de cuota pendiente sin deber nada todavía.
  const pendingEnrollments = activeEnrollments.filter((e: any) =>
    (!e.start_date || e.start_date <= todaySpain) && !isPaidThisMonth(e.paid_until)
  )

  const holidaySet = getHolidaySet((clubRow as any)?.config)
  const nextClass = (activeEnrollments as any[])
    .flatMap((e: any) => {
      const nextDate = getNextOccurrence((e.schedule as any)?.start_time ?? '', holidaySet)
      if (!nextDate) return []
      const nextDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(nextDate)
      const override = (timeOverrides ?? []).find(
        (o: any) => o.schedule_id === (e.schedule as any)?.id && o.override_date === nextDateStr
      )
      return [{ ...e, nextDate, override: override ?? null }]
    })
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())[0]

  const level = levelData

  const absenceSpots = (spots ?? []).filter((s: any) => {
    if (holidaySet.has(s.excluded_date)) return false
    const schedule = (s.group_enrollment as any)?.schedule
    const clubOk = !clubId || schedule?.club_id === clubId
    const levelId = schedule?.level_id ?? null
    const levelOk = !myLevelId || !levelId || levelId === myLevelId
    return clubOk && levelOk
  })
  const absenceCount = absenceSpots.length
  const absenceScheduleIds = new Set(absenceSpots.map((s: any) => (s.group_enrollment as any)?.schedule_id).filter(Boolean))

  const myEnrolledScheduleIds = new Set(activeEnrollments.map((e: any) => (e.schedule as any)?.id).filter(Boolean))

  function getClassDateHome(s: any): string | null {
    if (!s.start_time) return null
    if (isNaN(new Date(s.start_time).getTime())) return null
    if (s.recurrence === 'none') {
      const d = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(s.start_time))
      return d < today ? null : d
    }
    const base = new Date(s.start_time)
    const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
    const [sy, sm, sd] = todaySpain.split('-').map(Number)
    const nowH = parseInt(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date()))
    const classH = parseInt(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: TZ }).format(base))
    const classDow = getDayOfWeek(base)
    const todayDow = getDayOfWeek(new Date(Date.UTC(sy, sm - 1, sd, 10, 0, 0)))
    let daysUntil = (classDow - todayDow + 7) % 7
    if (daysUntil === 0 && nowH >= classH) daysUntil = 7
    const result = new Date(Date.UTC(sy, sm - 1, sd + daysUntil, 10, 0, 0))
    const nextDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(result)
    const scheduleStartDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(base)
    if (nextDate < scheduleStartDate) return null
    if (s.recurrence_end_date && nextDate > s.recurrence_end_date) return null
    return nextDate
  }

  const capacityCount = (capacitySchedules ?? []).filter((s: any) => {
    const allEnrollments = (s.enrollments ?? []) as any[]
    const active = allEnrollments.filter((e: any) => e.status === 'active')
    const alreadyIn = active.some((e: any) => e.student_id === user.id) || myEnrolledScheduleIds.has(s.id)
    const levelId = (s.level as any)?.id ?? null
    const levelOk = !myLevelId || !levelId || levelId === myLevelId
    const classDate = getClassDateHome(s)
    if (!classDate || holidaySet.has(classDate)) return false
    if (absenceScheduleIds.has(s.id)) return false
    const alreadyBooked = (mySpotBookings ?? []).some((b: any) => b.schedule_id === s.id && b.class_date === classDate)
    return !alreadyIn && active.length < s.max_students && levelOk && !alreadyBooked
  }).length

  const spotsCount = absenceCount + capacityCount

  const firstName = ((userData as any)?.name as string | undefined)?.split(' ')[0]
    ?? user.user_metadata?.name?.split(' ')[0]
    ?? user.email?.split('@')[0]
    ?? ''
  const showPayment = !!nextClass && nextClass.monthly_price > 0 && billingActive && features.enable_payments
    && (!nextClass.start_date || nextClass.start_date <= todaySpain)
  const nextPaid = !!nextClass && isPaidThisMonth(nextClass.paid_until)

  const summary = [
    features.enable_bag && {
      href: '/student/bag',
      icon: Package,
      label: 'En tu bolsa',
      value: bagBalance,
      unit: bagBalance === 1 ? 'clase' : 'clases',
      highlight: bagBalance > 0,
    },
    features.enable_spots && {
      href: '/student/spots',
      icon: UserPlus,
      label: 'Huecos libres',
      value: spotsCount,
      unit: spotsCount === 1 ? 'plaza' : 'plazas',
      highlight: spotsCount > 0,
    },
    {
      href: '/student/schedule',
      icon: CalendarDays,
      label: 'Tus grupos',
      value: activeEnrollments.length,
      unit: activeEnrollments.length === 1 ? 'grupo' : 'grupos',
      highlight: false,
    },
  ].filter(Boolean) as { href: string; icon: typeof Package; label: string; value: number; unit: string; highlight: boolean }[]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <RealtimeRefresh
        channelName={`student-home-${user.id}`}
        subs={[
          { table: 'class_bag', filter: `user_id=eq.${user.id}` },
          { table: 'schedule_exclusions', event: 'INSERT' },
          { table: 'bookings', filter: `student_id=eq.${user.id}` },
        ]}
      />

      <HomeBand>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-meta text-ink-3 max-md:text-chrome-ink-2">{formatLongDate(new Date())}</p>
          <h1 className="mt-1 font-display text-display text-ink max-md:text-white">Hola, {firstName}</h1>
        </div>
        {level?.name && <LevelTag name={`Nivel ${level.name.toLowerCase()}`} color={level.color} className="pb-1.5 max-md:text-chrome-ink" />}
      </header>

      {features.enable_payments && billingActive && pendingEnrollments.length > 0 && (
        <Notice
          tone="warn"
          icon={<CircleAlert />}
          action={<Link href="/student/schedule" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Pagar</Link>}
        >
          {pendingEnrollments.length === 1
            ? 'Tienes una cuota pendiente de pago.'
            : `Tienes ${pendingEnrollments.length} cuotas pendientes de pago.`}
        </Notice>
      )}

      {nextClass ? (
        <CourtCard
          eyebrow="Tu próxima clase"
          title={formatLongDate(nextClass.nextDate)}
          meta={
            <>
              <span className="font-medium text-chrome-ink">
                {formatClock(nextClass.override?.new_start_time ?? (nextClass.schedule as any)?.start_time)}
                {' – '}
                {formatClock(nextClass.override?.new_end_time ?? (nextClass.schedule as any)?.end_time)}
              </span>
              {(nextClass.schedule as any)?.court?.name && <> · {(nextClass.schedule as any).court.name}</>}
            </>
          }
          court={(nextClass.schedule as any)?.court?.name ?? undefined}
          status={
            showPayment ? (
              nextPaid
                ? <Badge className="bg-accent text-accent-on"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Mes pagado</Badge>
                : <Badge tone="warn"><CircleAlert className="h-3.5 w-3.5" aria-hidden />Cuota pendiente</Badge>
            ) : undefined
          }
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 text-meta text-chrome-ink-2">
              {nextClass.override
                ? <span className="inline-flex items-center gap-1.5 font-medium text-warn-soft"><Clock className="h-3.5 w-3.5" aria-hidden />Ese día cambia la hora</span>
                : showPayment
                  ? <span className="tabular-nums">{formatCurrency(nextClass.monthly_price)} al mes</span>
                  : <span />}
              <Link href="/student/schedule" className="inline-flex min-h-11 items-center font-medium text-accent hover:underline">
                Ver mis clases
              </Link>
            </div>
          }
        />
      ) : (
        <Card>
          <EmptyState
            icon={<CalendarDays />}
            title="No tienes clases fijas"
            description={features.enable_spots ? 'Puedes apuntarte a un hueco libre de tu nivel.' : 'Habla con el club para apuntarte a un grupo.'}
            action={features.enable_spots ? <Link href="/student/spots" className={buttonVariants()}>Ver huecos libres</Link> : undefined}
          />
        </Card>
      )}
      </HomeBand>

      <ProgressCard checklists={(checklists ?? []) as ProgressChecklist[]} />

      <Card className="overflow-hidden">
        <ul className="grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {summary.map(({ href, icon: Icon, label, value, unit, highlight }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink/[0.03] sm:flex-col sm:items-start sm:gap-2.5 sm:p-5">
                <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${highlight ? 'bg-accent-soft text-accent-ink' : 'bg-ink/[0.05] text-ink-3'}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-meta text-ink-3">{label}</span>
                  <span className="mt-0.5 block text-ink">
                    <span className="font-display text-title tabular-nums">{value}</span>
                    <span className="ml-1.5 text-body text-ink-2">{unit}</span>
                  </span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink-3 sm:hidden" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {features.enable_pista_viva && (
        <PistaVivaOptin
          optedIn={(userData as any)?.pista_viva_optin ?? false}
          level={(userData as any)?.playtomic_level ?? null}
          matches={visiblePistaVivaMatches}
          preferredDays={myPreferredDays}
          preferredStart={myPreferredStart}
          preferredEnd={myPreferredEnd}
        />
      )}
    </div>
  )
}
