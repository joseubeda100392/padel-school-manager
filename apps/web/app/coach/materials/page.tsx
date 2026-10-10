export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { getClubFeatures } from '@/lib/get-club-features'
import { FileText, FolderOpen } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { LevelTag } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { List, ListRow } from '@/components/ui/list'
import { buttonVariants } from '@/components/ui/button'

export default async function CoachMaterialsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await getAdminClient()
    .from('users')
    .select('club_id')
    .eq('id', user.id)
    .single()

  const features = await getClubFeatures(profile?.club_id)
  if (!features.enable_materials) redirect('/coach')

  const query = getAdminClient()
    .from('materials')
    .select('*, material_levels(level:levels(name, color))')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  const { data: materials } = await (
    profile?.club_id ? query.eq('club_id', profile.club_id) : query
  )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="Materia didáctica" description={`${materials?.length ?? 0} documentos`} />

      {!materials || materials.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderOpen />}
            title="No hay materias publicadas"
            description="Cuando el club publique documentos aparecerán aquí."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <List>
            {materials.map((m: any) => (
              <ListRow
                key={m.id}
                leading={
                  <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-control bg-ink/[0.05] text-ink-2">
                    <FileText className="h-5 w-5" />
                  </span>
                }
                title={<span className="block whitespace-normal">{m.title}</span>}
                subtitle={
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {m.description && <span className="w-full truncate">{m.description}</span>}
                    {m.material_levels?.map((ml: any, i: number) => (
                      <LevelTag key={i} name={ml.level?.name} color={ml.level?.color} />
                    ))}
                    {(!m.material_levels || m.material_levels.length === 0) && <span>Todos los niveles</span>}
                    <span className="tabular-nums">{formatDate(m.created_at)}</span>
                  </span>
                }
                trailing={
                  m.file_url ? (
                    <a
                      href={`/api/pdf/material/${m.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                      Abrir PDF
                    </a>
                  ) : undefined
                }
              />
            ))}
          </List>
        </Card>
      )}
    </div>
  )
}
