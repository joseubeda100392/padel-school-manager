export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin', 'coach'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (caller.role !== 'super_admin') {
    const { data: checklist } = await admin.from('student_checklists').select('club_id').eq('id', params.id).single()
    if (!checklist || checklist.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin acceso a este checklist' }, { status: 403 })
    }
  }

  const { completed } = await req.json()
  const update = completed
    ? { completed_at: new Date().toISOString(), completed_by_id: user.id }
    : { completed_at: null, completed_by_id: null }

  const { data, error } = await admin
    .from('student_checklists')
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
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin', 'coach'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (caller.role !== 'super_admin') {
    const { data: checklist } = await admin.from('student_checklists').select('club_id').eq('id', params.id).single()
    if (!checklist || checklist.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin acceso a este checklist' }, { status: 403 })
    }
  }

  const { error } = await admin.from('student_checklists').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
