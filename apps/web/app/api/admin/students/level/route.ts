export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
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

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    userId: z.string().uuid(),
    levelId: z.string().uuid().nullable().optional(),
  }))
  if (badRequest) return badRequest
  const { userId, levelId } = body

  if (caller.role !== 'super_admin') {
    const { data: target } = await admin.from('users').select('club_id').eq('id', userId).single()
    if (!target || !caller.club_id || target.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
  }

  const { error: updateErr } = await admin
    .from('users')
    .update({ current_level_id: levelId || null })
    .eq('id', userId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  if (levelId) {
    const { error: levelErr } = await admin.from('user_levels').insert({
      user_id: userId,
      level_id: levelId,
      assigned_by: user.id,
    })
    if (levelErr) console.error('[students/level] user_levels insert failed:', levelErr.message)
  }

  return NextResponse.json({ ok: true })
}
