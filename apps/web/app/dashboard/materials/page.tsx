export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { FileText, Plus, CircleCheck, FilePen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { DevError } from '@/components/dev-error'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { buttonVariants } from '@/components/ui/button'

export default async function MaterialsPage() {
  const supabase = createClient()
  const clubId = await getClubId()

  const features = await getClubFeatures(clubId ?? undefined)
  if (!features.enable_materials) redirect('/dashboard')

  const query = supabase
    .from('materials')
    .select('*, material_levels(level:levels(name, color))')
    .order('created_at', { ascending: false })

  const { data: materials, error: errMaterials } = await (clubId ? query.eq('club_id', clubId) : query)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <DevError errors={[errMaterials?.message]} />
      <PageHeader
        title="Materias didácticas"
        description={`${materials?.length ?? 0} documentos`}
        actions={
          <Link href="/dashboard/materials/new" className={buttonVariants({ className: 'w-full sm:w-auto' })}>
            <Plus className="h-4 w-4" aria-hidden />
            Subir materia
          </Link>
        }
      />

      {materials?.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText />}
            title="Todavía no hay materias"
            description="Sube el primer PDF y asígnalo a los niveles que lo necesiten."
            action={
              <Link href="/dashboard/materials/new" className={buttonVariants()}>
                Subir PDF
              </Link>
            }
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {materials?.map((m: any) => (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-surface-2 text-ink-2">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-heading text-ink">{m.title}</p>
                    {m.description && <p className="mt-0.5 text-body text-ink-2">{m.description}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                      {m.material_levels?.map((ml: any, i: number) => (
                        <LevelTag key={i} name={ml.level?.name ?? ''} color={ml.level?.color} />
                      ))}
                      {(!m.material_levels || m.material_levels.length === 0) && (
                        <span className="text-meta text-ink-3">Todos los niveles</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex w-full shrink-0 flex-wrap items-center gap-3 sm:w-auto">
                  <div className="flex items-center gap-2">
                    <Badge tone={m.is_published ? 'success' : 'neutral'}>
                      {m.is_published ? <CircleCheck className="h-3.5 w-3.5" aria-hidden /> : <FilePen className="h-3.5 w-3.5" aria-hidden />}
                      {m.is_published ? 'Publicado' : 'Borrador'}
                    </Badge>
                    <span className="text-meta tabular-nums text-ink-3">{formatDate(m.created_at)}</span>
                  </div>
                  <div className="flex gap-2">
                    {m.file_url && (
                      <a
                        href={`/api/pdf/material/${m.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                      >
                        Abrir
                      </a>
                    )}
                    <Link href={`/dashboard/materials/${m.id}/edit`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                      Editar
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
