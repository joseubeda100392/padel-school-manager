import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { StudentShell } from '@/components/layout/student-shell'
import { getClubFeatures } from '@/lib/get-club-features'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: userData } = await admin.from('users').select('name, club_id, clubs(name)').eq('id', user.id).single()
  const clubId = (userData as any)?.club_id as string | undefined

  const [{ data: bag }, { count: unreadCount }, features] = await Promise.all([
    admin.from('class_bag').select('balance_60, balance_90').eq('user_id', user.id).single(),
    admin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
    getClubFeatures(clubId),
  ])

  const clubName = (userData as any)?.clubs?.name ?? undefined

  return (
    <StudentShell
      userName={(userData as any)?.name ?? undefined}
      clubName={clubName}
      bagBalance={(bag?.balance_60 ?? 0) + (bag?.balance_90 ?? 0)}
      unreadCount={unreadCount ?? 0}
      features={features}
    >
      {children}
    </StudentShell>
  )
}
