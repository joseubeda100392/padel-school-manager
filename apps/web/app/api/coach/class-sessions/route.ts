export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// El profesor marca si una clase concreta se ha dado o no (módulo de
// validación, apagado por defecto). No dispara ningún efecto todavía —
// eso solo pasa cuando el admin confirma (POST /api/admin/class-sessions/confirm).
// Si quien marca es admin/super_admin, se autoconfirma en el mismo paso
// (conveniencia para cuando el admin lo hace sin pasar por el profesor).
export async function POST(req: NextRequest) {
  try {
    return await handlePost(req)
  } catch (e: any) {
    console.error('[coach/class-sessions] unhandled error:', e)
    return NextResponse.json({ error: 'Error inesperado: ' + (e?.message ?? String(e)) }, { status: 500 })
  }
}

async function handlePost(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['coach', 'admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    scheduleId: z.string().uuid(),
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(['given', 'not_given']),
    reason: z.string().max(300).optional(),
    absentStudentIds: z.array(z.string().uuid()).optional(),
  }))
  if (badRequest) return badRequest
  const { scheduleId, sessionDate, status, reason, absentStudentIds } = body

  const { data: schedule } = await admin
    .from('schedules')
    .select('id, club_id, coach_id, start_time')
    .eq('id', scheduleId)
    .single()
  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })

  if (caller.role === 'coach' && schedule.coach_id !== user.id) {
    return NextResponse.json({ error: 'Esta clase no es tuya' }, { status: 403 })
  }
  if (caller.role !== 'super_admin' && schedule.club_id !== caller.club_id) {
    return NextResponse.json({ error: 'Clase no pertenece a tu club' }, { status: 403 })
  }

  const { data: club } = await admin.from('clubs').select('features').eq('id', schedule.club_id).single()
  if (!(club as any)?.features?.enable_class_validation) {
    return NextResponse.json({ error: 'Módulo de validación de clases no activado para este club' }, { status: 400 })
  }

  const scheduleDow = new Date(schedule.start_time).getUTCDay()
  const requestedDow = new Date(sessionDate + 'T12:00:00Z').getUTCDay()
  if (scheduleDow !== requestedDow) {
    return NextResponse.json({ error: 'La fecha no corresponde al día habitual de esta clase' }, { status: 400 })
  }

  const { data: existingSession } = await admin
    .from('class_sessions')
    .select('id, confirmed_by_admin')
    .eq('schedule_id', scheduleId)
    .eq('session_date', sessionDate)
    .maybeSingle()
  if (existingSession?.confirmed_by_admin) {
    return NextResponse.json({ error: 'Esta sesión ya está confirmada por el admin, no se puede volver a marcar' }, { status: 409 })
  }

  const isAdminCaller = caller.role === 'admin' || caller.role === 'super_admin'
  const nowIso = new Date().toISOString()

  const upsertPayload: Record<string, unknown> = {
    schedule_id: scheduleId,
    club_id: schedule.club_id,
    session_date: sessionDate,
    status,
    cancel_reason: status === 'not_given' ? (reason ?? null) : null,
    marked_by_coach: user.id,
    marked_by_coach_at: nowIso,
  }
  if (isAdminCaller) {
    upsertPayload.confirmed_by_admin = user.id
    upsertPayload.confirmed_by_admin_at = nowIso
  }

  const { data: session, error } = await admin
    .from('class_sessions')
    .upsert(upsertPayload, { onConflict: 'schedule_id,session_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Error al guardar la sesión: ' + error.message }, { status: 500 })

  // Siempre se limpia el set de ausencias anterior antes de reescribirlo —
  // si no, al corregir una marca (p.ej. quitar a alguien de la lista de
  // ausentes) quedaría basura de la marca anterior.
  await admin.from('class_session_absences').delete().eq('class_session_id', session.id)
  if (status === 'given' && absentStudentIds?.length) {
    const { error: absErr } = await admin
      .from('class_session_absences')
      .insert(absentStudentIds.map((studentId) => ({ class_session_id: session.id, student_id: studentId })))
    if (absErr) return NextResponse.json({ error: 'Sesión guardada, pero error al guardar ausencias: ' + absErr.message }, { status: 500 })
  }

  // Si el admin marcó directamente (autoconfirmado), aplicar ya los efectos.
  if (isAdminCaller) {
    const { applySessionEffects } = await import('@/lib/class-session-effects')
    await applySessionEffects(admin, session.id)
  }

  return NextResponse.json({ data: session })
}
