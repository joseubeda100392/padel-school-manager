import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getClubFeatures } from '@/lib/get-club-features'
import { BookOpen, FileText } from 'lucide-react'
import { formatLongDate } from '@/lib/format-date'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { LevelTag } from '@/components/ui/badge'
import { List, ListRow } from '@/components/ui/list'
import { buttonVariants } from '@/components/ui/button'

export default async function StudentMaterialsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await getAdminClient()
    .from('users')
    .select('current_level_id, club_id')
    .eq('id', user.id)
    .single()

  const features = await getClubFeatures((userData as any)?.club_id)
  if (!features.enable_materials) redirect('/student')

  const levelId = (userData as any)?.current_level_id ?? null
  const { data: levelData } = levelId
    ? await getAdminClient().from('levels').select('name, color').eq('id', levelId).single()
    : { data: null }

  const clubId = (userData as any)?.club_id ?? null
  const materialsQuery = getAdminClient()
    .from('materials')
    .select('id, title, description, file_url, created_at, material_levels(level_id)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  const { data: materialsRaw } = await (clubId ? materialsQuery.eq('club_id', clubId) : materialsQuery)

  // Show materials for student's level + materials with no level assigned (global)
  const materials = (materialsRaw ?? []).filter((m: any) => {
    const levels = m.material_levels ?? []
    if (levels.length === 0) return true
    if (!levelId) return false
    return levels.some((ml: any) => ml.level_id === levelId)
  })

  const myLevel = levelData

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Materia didáctica"
        description={
          myLevel ? (
            <span className="inline-flex flex-wrap items-center gap-x-2">
              PDFs para tu nivel: <LevelTag name={myLevel.name} color={myLevel.color} className="text-body" />
            </span>
          ) : (
            'PDFs disponibles'
          )
        }
      />

      {materials.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen />}
            title="Todavía no hay materia para tu nivel"
            description="Tu monitor la irá subiendo próximamente."
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
                title={m.title}
                subtitle={
                  <>
                    {m.description && <span className="line-clamp-2 block text-ink-2">{m.description}</span>}
                    <span className="block">{formatLongDate(m.created_at, { weekday: false })}</span>
                  </>
                }
                trailing={
                  m.file_url ? (
                    <a
                      href={`/api/pdf/material/${m.id}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir PDF: ${m.title}`}
                      className={buttonVariants({ variant: 'secondary', size: 'md' })}
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
