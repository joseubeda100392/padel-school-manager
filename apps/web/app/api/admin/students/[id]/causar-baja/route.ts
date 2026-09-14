export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

const TZ = 'Europe/Madrid'

function todayInMadrid(): { year: number; month0: number; day: number } {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const [year, month, day] = todayStr.split('-').map(Number)
  return { year, month0: month - 1, day }
}

function lastDayOfThisMonth(): string {
  const { year, month0 } = todayInMadrid()
  return new Date(year, month0 + 1, 0).toISOString().split('T')[0]
}

function firstDayOfNextMonth(): string {
  const { year, month0 } = todayInMadrid()
  return new Date(year, month0 + 1, 1).toISOString().split('T')[0]
}

// Causar baja para el mes que viene: al alumno saliente se le pone
// end_date = último día de este mes en todas sus clases fijas activas (el
// proceso diario /api/cron/process-bajas le quitará de verdad y le
// desactivará cuando llegue esa fecha). Si hay sustituto, se le da de alta
// YA en esas mismas clases, pero con start_date = día 1 del mes que viene —
// así no cuenta para el aforo de este mes (ver el fix de start_date/end_date
// en book_capacity_spot y compañía).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const studentId = params.id
  const { data: student } = await admin.from('users').select('club_id, name').eq('id', studentId).single()
  if (!student || (caller.role !== 'super_admin' && student.club_id !== caller.club_id)) {
    return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const substituteId: string | null = body.substituteId || null

  if (substituteId) {
    const { data: substitute } = await admin.from('users').select('club_id').eq('id', substituteId).single()
    if (!substitute || substitute.club_id !== student.club_id) {
      return NextResponse.json({ error: 'El sustituto no pertenece al mismo club' }, { status: 400 })
    }
    if (substituteId === studentId) {
      return NextResponse.json({ error: 'El sustituto no puede ser el propio alumno' }, { status: 400 })
    }
  }

  const { data: enrollments } = await admin
    .from('group_enrollments')
    .select('id, schedule_id, monthly_price, price_per_class_cents, court_pricing, club_id, schedule:schedules(max_students)')
    .eq('student_id', studentId)
    .eq('status', 'active')

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ error: 'Este alumno no tiene clases fijas activas que dar de baja' }, { status: 400 })
  }

  const endDate = lastDayOfThisMonth()
  const startDate = firstDayOfNextMonth()

  // Fecha efectiva del sustituto: se comprueba el aforo excluyendo al
  // alumno saliente (para esa fecha ya no estará) — así funciona bien
  // independientemente de si el proceso diario ya ha corrido o no.
  if (substituteId) {
    for (const e of enrollments) {
      const maxStudents = (e as any).schedule?.max_students as number | undefined
      if (!maxStudents) continue
      const { count: otherActive } = await admin
        .from('group_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('schedule_id', e.schedule_id)
        .eq('status', 'active')
        .neq('id', e.id)
      if ((otherActive ?? 0) + 1 > maxStudents) {
        return NextResponse.json({
          error: `No se puede meter al sustituto: esa clase ya estaría completa a partir de octubre sin contar al alumno saliente.`,
        }, { status: 409 })
      }
    }
    const { data: alreadyThere } = await admin
      .from('group_enrollments')
      .select('id')
      .eq('student_id', substituteId)
      .eq('status', 'active')
      .in('schedule_id', enrollments.map(e => e.schedule_id))
    if (alreadyThere && alreadyThere.length > 0) {
      return NextResponse.json({ error: 'El sustituto ya está inscrito en alguna de estas clases' }, { status: 409 })
    }
  }

  await admin
    .from('group_enrollments')
    .update({ end_date: endDate })
    .in('id', enrollments.map(e => e.id))

  if (substituteId) {
    const rows = enrollments.map(e => ({
      schedule_id: e.schedule_id,
      student_id: substituteId,
      club_id: e.club_id,
      monthly_price: e.monthly_price,
      price_per_class_cents: e.price_per_class_cents,
      court_pricing: e.court_pricing,
      status: 'active',
      enrolled_by: user.id,
      enrolled_at: new Date().toISOString(),
      start_date: startDate,
      paid_until: null,
      replaces_enrollment_id: e.id,
    }))
    const { error: subErr } = await admin.from('group_enrollments').insert(rows)
    if (subErr) {
      // Revertir la baja si el sustituto falló, para no dejar el alumno
      // saliente "de baja" sin que nadie ocupe su sitio si eso no era el plan.
      await admin.from('group_enrollments').update({ end_date: null }).in('id', enrollments.map(e => e.id))
      return NextResponse.json({ error: 'Error al dar de alta al sustituto' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, endDate, startDate, classesAffected: enrollments.length })
}

// Cancelar una baja programada (antes de que se procese): quita end_date de
// sus clases y borra la inscripción del sustituto si había uno.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const studentId = params.id
  const { data: student } = await admin.from('users').select('club_id').eq('id', studentId).single()
  if (!student || (caller.role !== 'super_admin' && student.club_id !== caller.club_id)) {
    return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 })
  }

  const { data: pending } = await admin
    .from('group_enrollments')
    .select('id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .not('end_date', 'is', null)

  if (!pending || pending.length === 0) {
    return NextResponse.json({ error: 'Este alumno no tiene ninguna baja programada' }, { status: 400 })
  }

  const pendingIds = pending.map(p => p.id)
  await admin.from('group_enrollments').delete().in('replaces_enrollment_id', pendingIds)
  await admin.from('group_enrollments').update({ end_date: null }).in('id', pendingIds)

  return NextResponse.json({ ok: true })
}
