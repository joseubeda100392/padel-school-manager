export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'
import { IntensivosClient } from './intensivos-client'
import { getClubFeatures } from '@/lib/get-club-features'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TZ = 'Europe/Madrid'

export default async function StudentIntensivosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())

  const { data: userRow } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const myClubId: string | null = (userRow as any)?.club_id ?? null

  const features = await getClubFeatures(myClubId)

  const [{ data: schedulesRaw }, { data: myBookings }] = await Promise.all([
    myClubId
      ? admin
          .from('schedules')
          .select(`
            id, start_time, end_time, max_students, price_cents, intensivo_group_id,
            court:courts(name),
            level:levels(id, name, color),
            coach:users!schedules_coach_id_fkey(name),
            enrollments:group_enrollments(student_id, status)
          `)
          .eq('club_id', myClubId)
          .eq('type', 'intensivo')
          .eq('recurrence', 'none')
          .eq('is_active', true)
      : { data: [] },
    admin
      .from('bookings')
      .select('schedule_id')
      .eq('student_id', user.id)
      .eq('status', 'confirmed'),
  ])

  const bookedScheduleIds = new Set((myBookings ?? []).map((b: any) => b.schedule_id))

  // Group by intensivo_group_id, filter to current/future
  const groups: Record<string, any[]> = {}
  for (const s of schedulesRaw ?? []) {
    const gid = (s as any).intensivo_group_id
    if (!gid) continue
    const scheduleDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(s.start_time))
    if (scheduleDate < today) continue
    if (!groups[gid]) groups[gid] = []
    groups[gid].push({ ...s, scheduleDate })
  }

  const packs = Object.entries(groups).map(([groupId, classes]) => {
    const sorted = [...classes].sort((a, b) => a.start_time.localeCompare(b.start_time))
    const first = sorted[0]
    const startDt = new Date(first.start_time)
    const endDt = new Date(first.end_time)
    const totalPrice = sorted.reduce((sum: number, s: any) => sum + ((s.price_cents as number | null) ?? 0), 0)
    const isEnrolled = sorted.some((s: any) => bookedScheduleIds.has(s.id))
    const isFull = sorted.some((s: any) => {
      const active = ((s.enrollments ?? []) as any[]).filter((e: any) => e.status === 'active')
      return active.length >= s.max_students
    })

    return {
      groupId,
      scheduleIds: sorted.map((s: any) => s.id),
      classDates: sorted.map((s: any) => s.scheduleDate),
      days: sorted.map((s: any) => DAYS[getDayOfWeek(new Date(s.start_time))]),
      startTime: formatTime(startDt),
      endTime: formatTime(endDt),
      courtName: (first.court as any)?.name ?? '—',
      coachName: (first.coach as any)?.name ?? null,
      maxStudents: first.max_students,
      level: first.level as any,
      totalPriceCents: totalPrice,
      firstDate: sorted[0].scheduleDate,
      isEnrolled,
      isFull,
    }
  }).sort((a, b) => a.firstDate.localeCompare(b.firstDate))

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Intensivos</h1>
        <p className="text-sm text-gray-500">Semanas de clases intensivas organizadas por tu club</p>
      </div>

      {packs.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-2xl mb-2">☀️</p>
          <p className="text-gray-400">No hay intensivos disponibles por ahora.</p>
          <p className="mt-1 text-xs text-gray-400">Tu club publicará los intensivos de verano próximamente.</p>
        </div>
      ) : (
        <IntensivosClient packs={packs} enablePayments={features.enable_payments} />
      )}
    </div>
  )
}
