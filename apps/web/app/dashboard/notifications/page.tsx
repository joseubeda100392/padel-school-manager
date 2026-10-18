export const dynamic = 'force-dynamic'

import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { getAdminClient } from '@/lib/supabase/admin'
import { NotificationsClient } from './notifications-client'

export default async function NotificationsPage() {
  const clubId = await getClubId()
  const features = await getClubFeatures(clubId ?? undefined)

  // Cuántos alumnos reciben de verdad los avisos en el móvil, para que el club
  // sepa a cuántos llega y pueda animar al resto a activarlos.
  const admin = getAdminClient()
  let students: { id: string }[] = []
  if (clubId) {
    const { data } = await admin.from('users').select('id').eq('club_id', clubId).eq('role', 'student').eq('is_active', true)
    students = data ?? []
  }
  const { data: subs } = students.length
    ? await admin.from('push_subscriptions').select('user_id').in('user_id', students.map(s => s.id))
    : { data: [] }
  const withPush = new Set((subs ?? []).map((s: any) => s.user_id)).size

  return (
    <NotificationsClient
      enablePayments={features.enable_payments}
      pushStats={{ withPush, students: students.length }}
    />
  )
}
