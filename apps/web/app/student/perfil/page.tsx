import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PerfilClient } from './perfil-client'

export default async function PerfilPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: userData } = await admin
    .from('users')
    .select('name, email, current_level_id, levels(name)')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-sm text-gray-500">Tus datos y configuración de cuenta</p>
      </div>

      <PerfilClient
        name={(userData as any)?.name ?? ''}
        email={user.email ?? ''}
        levelName={(userData as any)?.levels?.name ?? null}
      />
    </div>
  )
}
