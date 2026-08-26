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

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    scheduleId: z.string().uuid(),
    studentId: z.string().uuid(),
    monthlyPrice: z.number().nonnegative().optional(),
    pricePerClassCents: z.number().nonnegative().nullish(),
    courtPricing: z.enum(['con_pista', 'sin_pista']).nullish(),
  }))
  if (badRequest) return badRequest
  const { scheduleId, studentId, monthlyPrice, pricePerClassCents, courtPricing } = body

  const admin = getAdminClient()

  const { data: adminUser } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const [{ data: schedule }, { data: student }, { data: existingEnrollments }, { data: studentSchedules }] = await Promise.all([
    admin.from('schedules').select('level_id, start_time, end_time, recurrence_end_date, club_id').eq('id', scheduleId).single(),
    admin.from('users').select('current_level_id, club_id').eq('id', studentId).single(),
    admin.from('group_enrollments')
      .select('student:users!group_enrollments_student_id_fkey(current_level_id)')
      .eq('schedule_id', scheduleId)
      .eq('status', 'active'),
    admin.from('group_enrollments')
      .select('schedule:schedules!inner(id, start_time, end_time, recurrence_end_date)')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .neq('schedule_id', scheduleId),
  ])

  if (adminUser.role !== 'super_admin') {
    if (!schedule || (schedule as any).club_id !== adminUser.club_id) {
      return NextResponse.json({ error: 'Sin permisos: clase no pertenece a tu club' }, { status: 403 })
    }
    if (!student || (student as any).club_id !== adminUser.club_id) {
      return NextResponse.json({ error: 'Sin permisos: alumno no pertenece a tu club' }, { status: 403 })
    }
  }

  // level_id on schedule takes priority; if absent, infer from already-enrolled students
  const enrolledLevels = [...new Set(
    (existingEnrollments ?? []).map((e: any) => e.student?.current_level_id).filter(Boolean)
  )]
  const effectiveLevelId: string | null = schedule?.level_id ?? (enrolledLevels.length === 1 ? enrolledLevels[0] : null)

  if (schedule) {
    const TZ = 'Europe/Madrid'
    const dateOnly = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso))
    const newDow = new Date(schedule.start_time).getUTCDay()
    const newStart = new Date(schedule.start_time).getUTCHours() * 60 + new Date(schedule.start_time).getUTCMinutes()
    const newEnd = new Date(schedule.end_time).getUTCHours() * 60 + new Date(schedule.end_time).getUTCMinutes()
    const newStartDate = dateOnly(schedule.start_time)
    const newEndDate = (schedule as any).recurrence_end_date ?? null
    const clash = (studentSchedules ?? []).some((e: any) => {
      const s = e.schedule
      if (!s) return false
      if (new Date(s.start_time).getUTCDay() !== newDow) return false
      const exStart = new Date(s.start_time).getUTCHours() * 60 + new Date(s.start_time).getUTCMinutes()
      const exEnd = new Date(s.end_time).getUTCHours() * 60 + new Date(s.end_time).getUTCMinutes()
      if (newStart >= exEnd || newEnd <= exStart) return false
      const sStartDate = dateOnly(s.start_time)
      const sEndDate = s.recurrence_end_date ?? null
      if (newEndDate && sStartDate > newEndDate) return false
      if (sEndDate && newStartDate > sEndDate) return false
      return true
    })
    if (clash) return NextResponse.json({ error: 'El alumno ya tiene otra clase a esa hora.' }, { status: 409 })
  }

  // Si el alumno ya pagó la cuota de este mes (p. ej. se le está moviendo de
  // grupo tras haber pagado en el anterior), se respeta ese pago en la
  // inscripción nueva en vez de marcarla como "sin pagar" — el pago queda
  // registrado en payments independientemente de qué inscripción existiera
  // en el momento de pagar, así que sobrevive aunque se borre la antigua.
  // Solo se respeta si la cuota nueva es igual o más barata que lo ya
  // pagado — si es más cara, no se da por buena automáticamente para no
  // dejar de cobrar la diferencia (queda "sin pagar" y se marca a mano).
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { data: recentPayment } = await admin
    .from('payments')
    .select('amount')
    .eq('user_id', studentId)
    .eq('club_id', adminUser.club_id)
    .eq('type', 'fixed_group_month')
    .eq('status', 'succeeded')
    .gte('created_at', startOfMonth)
    .order('amount', { ascending: false })
    .limit(1)
    .maybeSingle()

  const alreadyCoversNewPrice = !!recentPayment && recentPayment.amount >= (monthlyPrice ?? 0)
  const paidUntil = alreadyCoversNewPrice
    ? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    : null

  const { data, error } = await admin.from('group_enrollments').upsert({
    schedule_id: scheduleId,
    student_id: studentId,
    club_id: adminUser.club_id,
    monthly_price: monthlyPrice ?? 0,
    price_per_class_cents: pricePerClassCents ?? null,
    court_pricing: courtPricing ?? null,
    status: 'active',
    enrolled_by: user.id,
    enrolled_at: new Date().toISOString(),
    paid_until: paidUntil,
  }, { onConflict: 'schedule_id,student_id' }).select().single()

  if (error) return NextResponse.json({ error: 'Error al inscribir el alumno' }, { status: 400 })

  // Cancelar reservas puntuales futuras del alumno en esta clase (ya no las necesita)
  const today = new Date().toISOString().split('T')[0]
  await admin
    .from('bookings')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('student_id', studentId)
    .eq('source', 'admin')
    .gte('class_date', today)

  return NextResponse.json({ data })
}
