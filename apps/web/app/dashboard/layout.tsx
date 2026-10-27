import { cookies } from 'next/headers'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { getClubFeatures } from '@/lib/get-club-features'
import { getCoordinatorNetwork } from '@/lib/network'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const user = await getAuthUser()

  if (!user) redirect('/login')

  const admin = getAdminClient()

  const { data: dbProfile } = await admin
    .from('users')
    .select('role, club_id, name, also_coach')
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

  const [clubData, features, network] = await Promise.all([
    effectiveClubId
      ? admin.from('clubs').select('name').eq('id', effectiveClubId).single()
      : Promise.resolve({ data: null }),
    getClubFeatures(effectiveClubId),
    role === 'admin' ? getCoordinatorNetwork(admin, user.id) : Promise.resolve(null),
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
      network={network ? { name: network.name, clubs: network.clubs } : undefined}
      currentClubId={effectiveClubId}
      alsoCoach={role === 'admin' && (dbProfile as any)?.also_coach === true}
    >
      {children}
    </DashboardShell>
  )
}
