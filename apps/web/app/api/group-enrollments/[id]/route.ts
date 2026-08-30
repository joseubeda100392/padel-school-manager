export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push'
import { formatTime, getDayOfWeek } from '@/lib/utils'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: adminUser } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (adminUser.role !== 'super_admin') {
    const { data: enrollment } = await admin.from('group_enrollments').select('club_id').eq('id', params.id).single()
    if (!enrollment || enrollment.club_id !== adminUser.club_id) {
      return NextResponse.json({ error: 'Inscripción no pertenece a tu club' }, { status: 403 })
    }
  }

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.monthly_price !== undefined) updates.monthly_price = body.monthly_price
  if (body.price_per_class_cents !== undefined) updates.price_per_class_cents = body.price_per_class_cents
  if (body.discount_applied !== undefined) updates.discount_applied = body.discount_applied
  if (body.court_pricing !== undefined) {
    if (body.court_pricing !== null && !['con_pista', 'sin_pista'].includes(body.court_pricing)) {
      return NextResponse.json({ error: 'court_pricing inválido' }, { status: 400 })
    }
    updates.court_pricing = body.court_pricing
  }

  const { error } = await admin
    .from('group_enrollments')
    .update(updates)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: 'Error al actualizar la inscripción' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: adminUser } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: enrollment } = await admin
    .from('group_enrollments')
    .select('club_id, student:users!group_enrollments_student_id_fkey(name), schedule:schedules(coach_id, start_time, end_time, court:courts(name))')
    .eq('id', params.id)
    .single()

  if (adminUser.role !== 'super_admin' && (!enrollment || enrollment.club_id !== adminUser.club_id)) {
    return NextResponse.json({ error: 'Inscripción no pertenece a tu club' }, { status: 403 })
  }

  await admin.from('schedule_exclusions').delete().eq('group_enrollment_id', params.id)
  const { error: deleteErr } = await admin.from('group_enrollments').delete().eq('id', params.id)
  if (deleteErr) return NextResponse.json({ error: 'Error al dar de baja al alumno' }, { status: 500 })

  // Avisar al monitor de esa clase — no debe romper la baja si falla.
  try {
    const schedule = (enrollment as any)?.schedule
    const studentName = (enrollment as any)?.student?.name
    if (schedule?.coach_id && studentName) {
      const startDt = new Date(schedule.start_time)
      await sendPushToUsers([schedule.coach_id], {
        title: '🎾 Baja en tu clase',
        body: `${studentName} ha causado baja en tu clase del ${DAYS[getDayOfWeek(startDt)]} ${formatTime(startDt)} (${schedule.court?.name ?? 'pista'}).`,
      }, 'group_enrollment_removed')
    }
  } catch (err) {
    console.error('[group-enrollments DELETE] coach notification failed:', err)
  }

  return NextResponse.json({ ok: true })
}
