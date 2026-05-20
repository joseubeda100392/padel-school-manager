import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { MaterialsClient } from './materials-client'

export default async function StudentMaterialsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await getAdminClient()
    .from('users')
    .select('current_level_id')
    .eq('id', user.id)
    .single()

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

  const myLevel = levelData as { name: string; color: string } | null

  return (
    <MaterialsClient
      materials={materials}
      levelName={myLevel?.name ?? null}
      levelColor={myLevel?.color ?? null}
    />
  )
}
