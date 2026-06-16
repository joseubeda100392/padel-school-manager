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
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { userId, levelId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const { error: updateErr } = await admin
    .from('users')
    .update({ current_level_id: levelId || null })
    .eq('id', userId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  if (levelId) {
    await admin.from('user_levels').insert({
      user_id: userId,
      level_id: levelId,
      assigned_by: user.id,
    })
  }

  return NextResponse.json({ ok: true })
}
