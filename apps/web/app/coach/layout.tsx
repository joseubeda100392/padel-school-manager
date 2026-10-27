import { createClient, getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { CoachShell } from '@/components/layout/coach-shell'
import { getClubFeatures } from '@/lib/get-club-features'
import { isCoachUser } from '@/lib/coach-role'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const { data: profile } = await getAdminClient()
    .from('users')
    .select('role, also_student, also_coach, name, club_id, clubs(name)')
    .eq('id', user.id)
    .single()

  if (!profile || !isCoachUser(profile as any)) redirect('/dashboard')
  // Admin que también da clases: vuelve a su panel y no usa el chat de monitor
  // (el chat del club ya lo gestiona como admin).
  const isAdmin = profile.role === 'admin'

  const clubId = (profile as any)?.club_id as string | undefined
  const clubName = (profile as any)?.clubs?.name ?? undefined
  const features = await getClubFeatures(clubId)

  return (
    <CoachShell
      userName={profile.name ?? undefined}
      clubName={clubName}
      features={isAdmin ? { ...features, enable_chat: false } : features}
      alsoStudent={(profile as any)?.also_student === true}
      isAdmin={isAdmin}
    >
      {children}
    </CoachShell>
  )
}
