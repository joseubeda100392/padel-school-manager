import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getClubFeatures } from '@/lib/get-club-features'
import { CircleCheck, FileText } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { List, ListRow } from '@/components/ui/list'
import { buttonVariants } from '@/components/ui/button'

export default async function CoachTarifasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const clubId = profile?.club_id ?? null

  const features = await getClubFeatures(clubId)
  const docs = [
    { key: 'tarifas_pdf_url', label: 'Tarifas', description: 'Precios de clases y bonos', apiPath: '/api/pdf/tarifas' },
    { key: 'calendario_pdf_url', label: 'Calendario', description: 'Calendario de la temporada', apiPath: '/api/pdf/calendario' },
    { key: 'terms_pdf_url', label: 'Normas', description: 'Normas y condiciones de uso', apiPath: '/api/pdf/normas' },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="Tarifas y documentos" description="Documentos del club disponibles para consultar" />

      <Card className="overflow-hidden">
        <List>
          {docs.map(doc => {
            const hasUrl = !!features[doc.key as keyof typeof features]
            return (
              <ListRow
                key={doc.key}
                leading={
                  <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-control bg-ink/[0.05] text-ink-2">
                    <FileText className="h-5 w-5" />
                  </span>
                }
                title={doc.label}
                subtitle={doc.description}
                trailing={
                  hasUrl ? (
                    <span className="flex flex-col items-end gap-1.5">
                      <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Disponible</Badge>
                      <a
                        href={doc.apiPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                      >
                        Ver PDF
                      </a>
                    </span>
                  ) : (
                    <Badge tone="neutral">No disponible todavía</Badge>
                  )
                }
              />
            )
          })}
        </List>
      </Card>
    </div>
  )
}
