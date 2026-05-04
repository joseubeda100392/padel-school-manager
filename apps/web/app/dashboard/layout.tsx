import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role as string | undefined
  const clubId = user?.user_metadata?.club_id as string | undefined

  let clubName: string | undefined
  let userName: string | undefined

  const [clubResult, userResult] = await Promise.all([
    clubId && role !== 'super_admin'
      ? supabase.from('clubs').select('name').eq('id', clubId).single()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from('users').select('name').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  clubName = (clubResult as any).data?.name ?? undefined
  userName = (userResult as any).data?.name ?? user?.user_metadata?.name ?? undefined

  return (
    <DashboardShell clubName={clubName} role={role} userName={userName}>
      {children}
    </DashboardShell>
  )
}
