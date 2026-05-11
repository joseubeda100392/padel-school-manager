import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StudentShell } from '@/components/layout/student-shell'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: userData }, { data: bag }] = await Promise.all([
    supabase.from('users').select('name, club_id, clubs(name)').eq('id', user.id).single(),
    supabase.from('class_bag').select('balance').eq('user_id', user.id).single(),
  ])

  const clubName = (userData as any)?.clubs?.name ?? undefined

  return (
    <StudentShell
      userName={(userData as any)?.name ?? undefined}
      clubName={clubName}
      bagBalance={bag?.balance ?? 0}
    >
      {children}
    </StudentShell>
  )
}
