import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { CoachShell } from '@/components/layout/coach-shell'
import { getClubFeatures } from '@/lib/get-club-features'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await getAdminClient()
    .from('users')
    .select('role, name, club_id, clubs(name)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'coach') redirect('/dashboard')

  const clubId = (profile as any)?.club_id as string | undefined
  const clubName = (profile as any)?.clubs?.name ?? undefined
  const features = await getClubFeatures(clubId)

  return (
    <CoachShell userName={profile.name ?? undefined} clubName={clubName} features={features}>
      {children}
    </CoachShell>
  )
}
