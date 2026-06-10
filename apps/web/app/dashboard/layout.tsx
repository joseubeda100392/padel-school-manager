import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { getClubFeatures } from '@/lib/get-club-features'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = getAdminClient()

  const { data: dbProfile } = await admin
    .from('users')
    .select('role, club_id, name')
    .eq('id', user.id)
    .single()

  const role = dbProfile?.role as string | undefined
  const clubId = dbProfile?.club_id as string | undefined

  if (!role || role === 'student') redirect('/student')
  if (role === 'coach') redirect('/coach')

  const cookieStore = cookies()
  const saActiveClub = role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? undefined)
    : undefined

  const effectiveClubId = saActiveClub ?? (role !== 'super_admin' ? clubId : undefined)

  const [clubData, features] = await Promise.all([
    effectiveClubId
      ? admin.from('clubs').select('name').eq('id', effectiveClubId).single()
      : Promise.resolve({ data: null }),
    getClubFeatures(effectiveClubId),
  ])

  const clubName = (clubData?.data as any)?.name ?? undefined
  const userName = dbProfile?.name ?? user.user_metadata?.name ?? undefined

  return (
    <DashboardShell
      clubName={clubName}
      role={role}
      userName={userName}
      features={features}
      saActiveClub={saActiveClub}
    >
      {children}
    </DashboardShell>
  )
}
