import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Role must come from DB — user_metadata is user-writable and can be spoofed
  const { data: dbProfile } = await supabase
    .from('users')
    .select('role, club_id, name')
    .eq('id', user.id)
    .single()

  const role = dbProfile?.role as string | undefined
  const clubId = dbProfile?.club_id as string | undefined

  if (!role || role === 'student') redirect('/student')
  if (role === 'coach') redirect('/coach')

  let clubName: string | undefined

  if (clubId && role !== 'super_admin') {
    const { data } = await supabase.from('clubs').select('name').eq('id', clubId).single()
    clubName = data?.name ?? undefined
  }

  const userName = dbProfile?.name ?? user.user_metadata?.name ?? undefined

  return (
    <DashboardShell clubName={clubName} role={role} userName={userName}>
      {children}
    </DashboardShell>
  )
}
