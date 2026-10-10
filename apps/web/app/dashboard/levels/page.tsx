export const dynamic = 'force-dynamic'

import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import Link from 'next/link'
import { LevelCard } from '@/components/levels/level-card'
import { DevError } from '@/components/dev-error'
import { Plus, Layers } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { List } from '@/components/ui/list'
import { EmptyState } from '@/components/ui/feedback'

export default async function LevelsPage() {
  const admin = getAdminClient()
  const clubId = await getClubId()

  const buildQuery = (query: any) => clubId ? query.eq('club_id', clubId) : query

  const { data: levels, error: errLevels } = await buildQuery(
    admin.from('levels').select('*')
  ).order('order', { ascending: true })

  const { data: counts } = await buildQuery(
    admin
      .from('users')
      .select('current_level_id')
      .eq('role', 'student')
      .not('current_level_id', 'is', null)
  )

  const countMap: Record<string, number> = {}
  counts?.forEach((u: any) => {
    countMap[u.current_level_id] = (countMap[u.current_level_id] ?? 0) + 1
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <DevError errors={[errLevels?.message]} />
      <PageHeader
        title="Niveles de juego"
        description="Gestiona los niveles y asígnalos a tus alumnos."
        actions={
          <Link href="/dashboard/levels/new" className={buttonVariants({ variant: 'primary' })}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo nivel
          </Link>
        }
      />

      <Card>
        {levels?.length ? (
          <List>
            {levels.map((level: any) => (
              <LevelCard key={level.id} level={level} studentCount={countMap[level.id] ?? 0} />
            ))}
          </List>
        ) : (
          <EmptyState
            icon={<Layers />}
            title="Aún no hay niveles"
            description="Crea el primer nivel para poder asignarlo a tus alumnos y a las clases."
            action={
              <Link href="/dashboard/levels/new" className={buttonVariants({ variant: 'primary' })}>
                Crear nivel
              </Link>
            }
          />
        )}
      </Card>
    </div>
  )
}
