export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { applySessionEffects } from '@/lib/class-session-effects'

// El admin confirma (o corrige y confirma) una sesión marcada por el
// profesor. Solo aquí se disparan los efectos reales (descuento / recuperaciones).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    return await handlePost(req, params.id)
  } catch (e: any) {
    console.error('[admin/class-sessions/confirm] unhandled error:', e)
    return NextResponse.json({ error: 'Error inesperado: ' + (e?.message ?? String(e)) }, { status: 500 })
  }
}

async function handlePost(req: NextRequest, sessionId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body } = await parseBody(req, z.object({
    status: z.enum(['given', 'not_given']).optional(),
    absentStudentIds: z.array(z.string().uuid()).optional(),
  }).optional().default({}))

  const { data: session } = await admin
    .from('class_sessions')
    .select('id, club_id, status, confirmed_by_admin')
    .eq('id', sessionId)
    .single()
  if (!session) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  if (caller.role !== 'super_admin' && session.club_id !== caller.club_id) {
    return NextResponse.json({ error: 'Sesión no pertenece a tu club' }, { status: 403 })
  }
  if (session.confirmed_by_admin) {
    return NextResponse.json({ error: 'Esta sesión ya estaba confirmada' }, { status: 409 })
  }

  const finalStatus = body?.status ?? session.status
  const updates: Record<string, unknown> = {
    confirmed_by_admin: user.id,
    confirmed_by_admin_at: new Date().toISOString(),
  }
  if (body?.status) updates.status = body.status

  const { error: updateErr } = await admin.from('class_sessions').update(updates).eq('id', sessionId)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  if (finalStatus === 'given' && body?.absentStudentIds) {
    await admin.from('class_session_absences').delete().eq('class_session_id', sessionId)
    if (body.absentStudentIds.length) {
      await admin
        .from('class_session_absences')
        .insert(body.absentStudentIds.map((studentId) => ({ class_session_id: sessionId, student_id: studentId })))
    }
  }

  await applySessionEffects(admin, sessionId)

  return NextResponse.json({ ok: true })
}
