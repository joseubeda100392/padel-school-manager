import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { Card, CardHeader } from '@/components/ui/card'
import { LevelTag } from '@/components/ui/badge'
import { PasswordForm } from '../password-form'

export default async function PerfilPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: userData } = await admin
    .from('users')
    .select('name, phone, current_level_id, clubs(name)')
    .eq('id', user.id)
    .single()
  const levelId = (userData as any)?.current_level_id as string | null
  const { data: level } = levelId
    ? await admin.from('levels').select('name, color').eq('id', levelId).single()
    : { data: null }

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Nombre', value: (userData as any)?.name || '—' },
    { label: 'Email', value: user.email ?? '—' },
    ...((userData as any)?.phone ? [{ label: 'Teléfono', value: (userData as any).phone as string }] : []),
    { label: 'Club', value: (userData as any)?.clubs?.name ?? '—' },
    { label: 'Nivel', value: level?.name ? <LevelTag name={level.name} color={level.color} /> : 'Sin asignar' },
  ]

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <h1 className="font-display text-title text-ink sm:text-display">Mis datos</h1>

      <Card>
        <CardHeader title="Datos personales" description="Para cambiar tu nombre, email o nivel, habla con el club." />
        <dl className="mt-3 divide-y divide-line border-t border-line">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-4 py-3 sm:px-5">
              <dt className="text-meta text-ink-3">{label}</dt>
              <dd className="min-w-0 break-words text-body text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <PasswordForm />
    </div>
  )
}
