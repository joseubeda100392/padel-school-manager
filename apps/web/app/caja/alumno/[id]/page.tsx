export const dynamic = 'force-dynamic'

import { getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { parseClubFeatures } from '@/lib/get-club-features'
import { lastDayOfMonthStr, currentBillingMonth } from '@/lib/billing-cycle'
import { isPlaceholderEmail } from '@/lib/login-identifier'
import { PageHeader } from '@/components/ui/page-header'
import { StudentFees } from './student-fees'

const HISTORY_LIMIT = 36

// Cobros de un alumno para el cobrador: sus grupos (cuota y hasta cuándo ha
// pagado, para cobrar lo pendiente), su fianza y su historial de pagos en el
// club, con el ticket de cada uno.
export default async function CajaAlumnoPage({ params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const admin = getAdminClient()

  const [{ data: me }, { data: student }] = await Promise.all([
    admin.from('users').select('club_id').eq('id', user.id).single(),
    admin.from('users').select('id, name, email, phone, role, also_student, club_id, deposit_paid').eq('id', params.id).single(),
  ])
  if (!student || !me?.club_id || student.club_id !== me.club_id || (student.role !== 'student' && !student.also_student)) notFound()

  const [{ data: club }, { data: enrollments }, { data: payments }] = await Promise.all([
    admin.from('clubs').select('features').eq('id', me.club_id).single(),
    admin
      .from('group_enrollments')
      .select('id, monthly_price, paid_until, start_date, end_date, schedule:schedules(start_time, end_time, level:levels(name, description))')
      .eq('student_id', student.id)
      .eq('club_id', me.club_id)
      .eq('status', 'active'),
    admin
      .from('payments')
      .select('id, amount, type, status, created_at, metadata')
      .eq('user_id', student.id)
      .eq('club_id', me.club_id)
      .in('status', ['succeeded', 'refunded'])
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT),
  ])
  const features = parseClubFeatures(club?.features)

  // Quién cobró cada pago (los cobros del club guardan collected_by).
  const collectorIds = [...new Set((payments ?? []).map((p: any) => p.metadata?.collected_by).filter(Boolean))] as string[]
  const { data: collectors } = collectorIds.length
    ? await admin.from('users').select('id, name').in('id', collectorIds)
    : { data: [] as { id: string; name: string }[] }
  const collectorName = new Map((collectors ?? []).map((c) => [c.id, c.name]))

  const billing = currentBillingMonth()
  const monthEnd = lastDayOfMonthStr(billing.year, billing.month0)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title={student.name} description="Cuotas, fianza y pagos del alumno." back={{ href: '/caja', label: 'Caja' }} />
      <StudentFees
        meId={user.id}
        student={{
          id: student.id,
          name: student.name,
          phone: student.phone ?? null,
          email: isPlaceholderEmail(student.email) ? null : student.email,
          depositPaid: student.deposit_paid === true,
        }}
        showDeposit={features.enable_deposit}
        monthEnd={monthEnd}
        enrollments={(enrollments ?? []).map((e: any) => ({
          id: e.id,
          monthly_price: e.monthly_price,
          paid_until: e.paid_until,
          start_date: e.start_date,
          end_date: e.end_date,
          start_time: e.schedule?.start_time ?? null,
          end_time: e.schedule?.end_time ?? null,
          level: e.schedule?.level?.description || e.schedule?.level?.name || null,
        }))}
        payments={(payments ?? []).map((p: any) => ({
          id: p.id,
          amount: p.amount,
          type: p.type,
          status: p.status,
          created_at: p.created_at,
          metadata: p.metadata ?? {},
          collectedBy: p.metadata?.collected_by ? collectorName.get(p.metadata.collected_by) ?? null : null,
        }))}
      />
    </div>
  )
}
