import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const scheduleId = searchParams.get('scheduleId')
  const levelId = searchParams.get('levelId')

  // Fetch all materials with their level associations
  const { data: materials, error } = await getAdminClient()
    .from('materials')
    .select(`
      id, title, description, file_url, schedule_id, created_at,
      material_levels(level_id)
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter: materials for this specific schedule, OR matching level, OR global (no schedule, no levels)
  const filtered = (materials ?? []).filter(m => {
    const levels = (m.material_levels ?? []) as { level_id: string }[]
    const hasLevels = levels.length > 0

    // Specific to this schedule
    if (scheduleId && m.schedule_id === scheduleId) return true

    // Level-based (no schedule restriction)
    if (!m.schedule_id && levelId && hasLevels && levels.some(l => l.level_id === levelId)) return true

    // Global: no schedule, no level restrictions
    if (!m.schedule_id && !hasLevels) return true

    return false
  })

  return NextResponse.json({
    materials: filtered.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      file_url: m.file_url,
      created_at: m.created_at,
    })),
  })
}
