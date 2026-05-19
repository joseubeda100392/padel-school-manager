export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

async function getCallerAndVerify(user: { id: string }, admin: ReturnType<typeof import('@/lib/supabase/admin').getAdminClient>, itemId: string) {
  const [{ data: caller }, { data: item }] = await Promise.all([
    admin.from('users').select('role, club_id').eq('id', user.id).single(),
    admin
      .from('checklist_items')
      .select('id, checklist_id, checklist:student_checklists(club_id)')
      .eq('id', itemId)
      .single(),
  ])
  if (!caller || !['admin', 'super_admin', 'coach'].includes(caller.role)) return null
  if (!item) return null
  const checklistClubId = (item as any).checklist?.club_id
  if (caller.role !== 'super_admin' && checklistClubId !== caller.club_id) return null
  return { caller, item }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const verified = await getCallerAndVerify(user, admin, params.id)
  if (!verified) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { completed } = await req.json()
  const update = completed
    ? { completed_at: new Date().toISOString(), completed_by_id: user.id }
    : { completed_at: null, completed_by_id: null }

  const { data, error } = await admin
    .from('checklist_items')
    .update(update)
    .eq('id', params.id)
    .select('id, completed_at, completed_by_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const verified = await getCallerAndVerify(user, admin, params.id)
  if (!verified) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const { error } = await admin.from('checklist_items').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
