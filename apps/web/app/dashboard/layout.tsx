import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role as string | undefined
  const clubId = user?.user_metadata?.club_id as string | undefined

  let clubName: string | undefined
  if (clubId && role !== 'super_admin') {
    const { data } = await supabase.from('clubs').select('name').eq('id', clubId).single()
    clubName = data?.name ?? undefined
  }

  return (
    <DashboardShell clubName={clubName} role={role}>
      {children}
    </DashboardShell>
  )
}
