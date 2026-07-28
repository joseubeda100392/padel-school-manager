export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DocumentosClient } from './documentos-client'

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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tarifas y documentos</h1>
        <p className="text-sm text-gray-500">Sube los PDFs del club. Todos los alumnos y monitores pueden consultarlos.</p>
      </div>
      <DocumentosClient clubId={clubId} isAdmin />
    </div>
  )
}
