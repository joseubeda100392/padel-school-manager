import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { NormasClient } from './normas-client'
import { PageHeader } from '@/components/ui/page-header'

export default async function DashboardNormasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('club_id')
    .eq('id', user.id)
    .single()

  const clubId = (profile as any)?.club_id ?? null

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="Normas y condiciones" description="Gestiona el PDF de condiciones de la escuela." />
      <NormasClient clubId={clubId} />
    </div>
  )
}
