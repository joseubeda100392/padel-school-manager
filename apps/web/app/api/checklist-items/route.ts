export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin', 'coach'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { checklistId, text } = await req.json()
  if (!checklistId || !text?.trim()) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  if (caller.role !== 'super_admin') {
    const { data: checklist } = await admin.from('student_checklists').select('club_id').eq('id', checklistId).single()
    if (!checklist || checklist.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin acceso a este checklist' }, { status: 403 })
    }
  }

  const { data: existing } = await admin
    .from('checklist_items')
    .select('sort_order')
    .eq('checklist_id', checklistId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = ((existing as any)?.sort_order ?? -1) + 1

  const { data, error } = await admin
    .from('checklist_items')
    .insert({ checklist_id: checklistId, text: text.trim(), sort_order: nextOrder })
    .select('id, text, sort_order, completed_at, completed_by_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
