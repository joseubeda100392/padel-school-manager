import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getClubFeatures } from '@/lib/get-club-features'

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

  const { data: materialsRaw } = await getAdminClient()
    .from('materials')
    .select('id, title, description, file_url, created_at, material_levels(level_id)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // Show materials for student's level + materials with no level assigned (global)
  const materials = (materialsRaw ?? []).filter((m: any) => {
    const levels = m.material_levels ?? []
    if (levels.length === 0) return true
    if (!levelId) return false
    return levels.some((ml: any) => ml.level_id === levelId)
  })

  const myLevel = levelData

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Material didáctico</h1>
        <p className="text-sm text-gray-500">
          {myLevel ? (
            <>PDFs para tu nivel: <span className="font-medium" style={{ color: myLevel.color }}>{myLevel.name}</span></>
          ) : (
            'PDFs disponibles'
          )}
        </p>
      </div>

      {materials.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-2xl mb-2">📚</p>
          <p className="text-gray-400">No hay materiales disponibles para tu nivel todavía.</p>
          <p className="mt-1 text-xs text-gray-400">Tu monitor los irá subiendo próximamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map((m: any) => (
            <div key={m.id} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <span className="text-xs font-bold text-red-600">PDF</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">{m.title}</p>
                {m.description && (
                  <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{m.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(m.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              {m.file_url && (
                <a
                  href={m.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Abrir
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
