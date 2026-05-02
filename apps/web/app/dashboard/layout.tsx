import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const clubId = user?.user_metadata?.club_id as string | undefined

  let clubName: string | undefined
  if (clubId) {
    const { data } = await supabase.from('clubs').select('name').eq('id', clubId).single()
    clubName = data?.name ?? undefined
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar clubName={clubName} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  )
}
