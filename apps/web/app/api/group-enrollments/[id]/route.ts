export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { processWaitlistForSchedule } from '@/lib/waitlist'
import { endEnrollment } from '@/lib/end-enrollment'
import { dayBefore, madridToday } from '@/lib/enrollment-window'

const MAX_DAYS_AHEAD = 366

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
  if (body.discount_cents !== undefined) {
    if (body.discount_cents !== null && !(Number.isInteger(body.discount_cents) && body.discount_cents >= 0)) {
      return NextResponse.json({ error: 'discount_cents inválido' }, { status: 400 })
    }
    updates.discount_cents = body.discount_cents
  }
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

// Quitar del grupo. Con lastDay (último día en el grupo) sale ese día y se
// conserva su historial; sin él, sale desde hoy. Un interesado de un grupo en
// formación no tiene historial: se borra.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
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

  const body = await req.json().catch(() => ({}))
  const today = madridToday()
  const lastDay: string = typeof body?.lastDay === 'string' ? body.lastDay : dayBefore(today)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastDay) || Number.isNaN(Date.parse(lastDay))) {
    return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 })
  }
  if (lastDay < dayBefore(today)) {
    return NextResponse.json({ error: 'El último día no puede ser anterior a ayer.' }, { status: 400 })
  }
  if (Date.parse(lastDay) - Date.parse(today) > MAX_DAYS_AHEAD * 86_400_000) {
    return NextResponse.json({ error: 'La fecha es demasiado lejana.' }, { status: 400 })
  }

  const { data: removed } = await admin.from('group_enrollments').select('id, schedule_id, student_id, status, start_date').eq('id', params.id).maybeSingle()
  if (!removed) return NextResponse.json({ error: 'Inscripción no encontrada' }, { status: 404 })
  if (removed.status === 'ended') return NextResponse.json({ error: 'Ya no está en este grupo.' }, { status: 409 })

  let result: string
  if (removed.status === 'pending') {
    await admin.from('group_enrollments').delete().eq('id', params.id)
    result = 'deleted'
  } else {
    result = await endEnrollment(admin, removed, lastDay, today)
  }
  // Su plaza queda libre desde el día siguiente: entran los que estén en reserva.
  await processWaitlistForSchedule(admin, removed.schedule_id)
  return NextResponse.json({ ok: true, result, lastDay })
}
