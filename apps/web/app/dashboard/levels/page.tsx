import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { LevelCard } from '@/components/levels/level-card'

export default async function LevelsPage() {
  const supabase = createClient()
  const clubId = await getClubId()

  const buildQuery = (query: any) => clubId ? query.eq('club_id', clubId) : query

  const { data: levels } = await buildQuery(
    supabase.from('levels').select('*')
  ).order('order', { ascending: true })

  const { data: counts } = await buildQuery(
    supabase
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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Niveles de Juego</h1>
          <p className="text-sm text-gray-500">Gestiona los niveles y asígnalos a tus alumnos</p>
        </div>
        <a
          href="/dashboard/levels/new"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          + Nuevo nivel
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {levels?.map((level: any) => (
          <LevelCard key={level.id} level={level} studentCount={countMap[level.id] ?? 0} />
        ))}
      </div>
    </div>
  )
}
