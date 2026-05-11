import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoachShell } from '@/components/layout/coach-shell'

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, name, club_id, clubs(name)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'coach') redirect('/dashboard')

  const clubName = (profile as any)?.clubs?.name ?? undefined

  return (
    <CoachShell userName={profile.name ?? undefined} clubName={clubName}>
      {children}
    </CoachShell>
  )
}
