export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DocumentosClient } from './documentos-client'
import { PageHeader } from '@/components/ui/page-header'

export default async function DashboardTarifasPage() {
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
      <PageHeader
        title="Tarifas y documentos"
        description="Sube los PDF del club. Todos los alumnos y monitores pueden consultarlos."
      />
      <DocumentosClient clubId={clubId} isAdmin />
    </div>
  )
}
