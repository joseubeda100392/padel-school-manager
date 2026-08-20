export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push'

// Sustituto de monitor puntual para una clase fija en una fecha concreta —
// no toca el monitor habitual, solo esa fecha. Se usa para que las horas
// automáticas (calculateCoachScheduledMonthlyHours) no se le atribuyan al
// titular si ese día no la da él.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    overrideDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    newCoachId: z.string().uuid(),
    reason: z.string().max(300).optional(),
  }))
  if (badRequest) return badRequest
  const { overrideDate, newCoachId, reason } = body

  const { data: schedule } = await admin
    .from('schedules')
    .select('id, club_id, start_time, recurrence_end_date, coach_id')
    .eq('id', params.id)
    .single()
  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })

  if (caller.role !== 'super_admin' && schedule.club_id !== caller.club_id) {
    return NextResponse.json({ error: 'Clase no pertenece a tu club' }, { status: 403 })
  }

  const scheduleDow = new Date(schedule.start_time).getUTCDay()
  const requestedDow = new Date(overrideDate + 'T12:00:00Z').getUTCDay()
  if (scheduleDow !== requestedDow) {
    return NextResponse.json({ error: 'La fecha no corresponde al día habitual de esta clase' }, { status: 400 })
  }
  if (schedule.recurrence_end_date && overrideDate > schedule.recurrence_end_date) {
    return NextResponse.json({ error: 'Esa clase ya ha terminado para esa fecha' }, { status: 400 })
  }

  const { data: newCoach } = await admin.from('users').select('id, name, role, club_id').eq('id', newCoachId).single()
  if (!newCoach || newCoach.role !== 'coach') {
    return NextResponse.json({ error: 'El sustituto debe ser un monitor del club' }, { status: 400 })
  }
  if (caller.role !== 'super_admin' && newCoach.club_id !== caller.club_id) {
    return NextResponse.json({ error: 'El sustituto debe ser un monitor del club' }, { status: 400 })
  }

  const { data: override, error } = await admin
    .from('schedule_coach_overrides')
    .upsert({
      schedule_id: params.id,
      club_id: schedule.club_id,
      override_date: overrideDate,
      new_coach_id: newCoachId,
      reason: reason ?? null,
      created_by: user.id,
    }, { onConflict: 'schedule_id,override_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Error al guardar el sustituto' }, { status: 500 })

  const notifyIds = [
    ...(schedule.coach_id ? [schedule.coach_id] : []),
    newCoachId,
  ]
  if (notifyIds.length) {
    const dateLabel = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(overrideDate + 'T12:00:00Z'))
    await sendPushToUsers(notifyIds, {
      title: 'Cambio de monitor puntual',
      body: `${newCoach.name} sustituye al monitor habitual el ${dateLabel}.`,
    }, 'class_reminder')
  }

  return NextResponse.json({ data: override })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const overrideDate = req.nextUrl.searchParams.get('date')
  if (!overrideDate) return NextResponse.json({ error: 'Falta la fecha' }, { status: 400 })

  const { data: schedule } = await admin.from('schedules').select('club_id').eq('id', params.id).single()
  if (!schedule) return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })
  if (caller.role !== 'super_admin' && schedule.club_id !== caller.club_id) {
    return NextResponse.json({ error: 'Clase no pertenece a tu club' }, { status: 403 })
  }

  await admin
    .from('schedule_coach_overrides')
    .delete()
    .eq('schedule_id', params.id)
    .eq('override_date', overrideDate)

  return NextResponse.json({ ok: true })
}
