export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

// admin (de club): solo baja lógica — no puede destruir historial de pagos
// por un cabreo o un click equivocado.
// super_admin: sigue pudiendo borrar de verdad (limpieza de datos de prueba,
// solicitudes de baja legal, etc.) — es un círculo de confianza mucho más
// pequeño que el de los admins de cada escuela.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const userId = params.id

  if (caller.role !== 'super_admin') {
    const { data: target } = await admin.from('users').select('club_id').eq('id', userId).single()
    if (!target || !caller.club_id || target.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos para desactivar este usuario' }, { status: 403 })
    }

    // --- Baja lógica ---
    const { error } = await admin
      .from('users')
      .update({ is_active: false, end_date: new Date().toISOString().split('T')[0] })
      .eq('id', userId)
    if (error) return NextResponse.json({ error: 'Error al desactivar el usuario' }, { status: 500 })

    await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' }).catch(() => {})
    return NextResponse.json({ ok: true })
  }

  // --- super_admin: borrado físico completo ---

  // Paso 1: nullear FKs nullable + obtener IDs necesarios (todo en paralelo)
  const [, , , , , , , , , , enrollmentsRes, studentBookingsRes, bagRes, schedulesRes, checklistsRes] =
    await Promise.all([
      admin.from('chat_threads').update({ recipient_id: null }).eq('recipient_id', userId),
      admin.from('schedule_exclusions').update({ created_by: null }).eq('created_by', userId),
      admin.from('makeups').update({ created_by: null }).eq('created_by', userId),
      admin.from('pista_viva_campaigns').update({ created_by: null }).eq('created_by', userId),
      admin.from('pista_viva_clicks').update({ user_id: null }).eq('user_id', userId),
      admin.from('group_enrollments').update({ enrolled_by: null }).eq('enrolled_by', userId),
      admin.from('push_campaigns').update({ sent_by: null }).eq('sent_by', userId),
      admin.from('student_checklists').update({ coach_id: null }).eq('coach_id', userId),
      admin.from('student_checklists').update({ completed_by_id: null }).eq('completed_by_id', userId),
      admin.from('checklist_items').update({ completed_by_id: null }).eq('completed_by_id', userId),
      admin.from('group_enrollments').select('id').eq('student_id', userId),
      admin.from('bookings').select('id').eq('student_id', userId),
      admin.from('class_bag').select('id').eq('user_id', userId).maybeSingle(),
      admin.from('schedules').select('id').eq('coach_id', userId),
      admin.from('student_checklists').select('id').eq('student_id', userId),
    ])

  const enrollmentIds = (enrollmentsRes.data ?? []).map((e: any) => e.id)
  const studentBookingIds = (studentBookingsRes.data ?? []).map((b: any) => b.id)
  const bag = bagRes.data
  const mySchedules = schedulesRes.data ?? []
  const checklistIds = (checklistsRes.data ?? []).map((c: any) => c.id)

  // Paso 2: limpiar horarios del monitor (coach_id NOT NULL — hay que borrar)
  if (mySchedules.length > 0) {
    const scheduleIds = mySchedules.map((s: any) => s.id)

    const [schedEnrollmentsRes, schedBookingsRes] = await Promise.all([
      admin.from('group_enrollments').select('id').in('schedule_id', scheduleIds),
      admin.from('bookings').select('id').in('schedule_id', scheduleIds),
    ])

    const schedEnrollIds = (schedEnrollmentsRes.data ?? []).map((e: any) => e.id)
    const schedBookingIds = (schedBookingsRes.data ?? []).map((b: any) => b.id)

    await Promise.all([
      schedEnrollIds.length > 0
        ? admin.from('schedule_exclusions').delete().in('group_enrollment_id', schedEnrollIds)
        : Promise.resolve(),
      schedBookingIds.length > 0
        ? admin.from('bag_transactions').delete().in('booking_id', schedBookingIds)
        : Promise.resolve(),
      schedBookingIds.length > 0
        ? admin.from('payments').delete().in('booking_id', schedBookingIds)
        : Promise.resolve(),
      admin.from('schedule_exclusions').delete().in('schedule_id', scheduleIds),
    ])

    await Promise.all([
      schedEnrollIds.length > 0
        ? admin.from('group_enrollments').delete().in('id', schedEnrollIds)
        : Promise.resolve(),
      schedBookingIds.length > 0
        ? admin.from('bookings').delete().in('id', schedBookingIds)
        : Promise.resolve(),
    ])

    await admin.from('schedules').delete().in('id', scheduleIds)
  }

  // Paso 3: limpiar dependencias del alumno (en paralelo donde es posible)
  await Promise.all([
    admin.from('user_levels').delete().eq('user_id', userId),
    admin.from('push_subscriptions').delete().eq('user_id', userId),
    admin.from('admin_recovery_codes').delete().eq('user_id', userId),
    admin.from('tournament_registrations').delete().eq('student_id', userId),
    admin.from('payment_mandates').delete().eq('user_id', userId),
    admin.from('makeups').delete().eq('student_id', userId),
    admin.from('notifications').delete().eq('user_id', userId),
    admin.from('chat_messages').delete().eq('sender_id', userId),
    enrollmentIds.length > 0
      ? admin.from('schedule_exclusions').delete().in('group_enrollment_id', enrollmentIds)
      : Promise.resolve(),
    studentBookingIds.length > 0
      ? admin.from('bag_transactions').delete().in('booking_id', studentBookingIds)
      : Promise.resolve(),
    studentBookingIds.length > 0
      ? admin.from('payments').delete().in('booking_id', studentBookingIds)
      : Promise.resolve(),
    bag
      ? admin.from('bag_transactions').delete().eq('class_bag_id', bag.id)
      : Promise.resolve(),
    checklistIds.length > 0
      ? admin.from('checklist_items').delete().in('checklist_id', checklistIds)
      : Promise.resolve(),
  ])

  // bag_transactions/payments residuales, luego las filas que dependen de ellas
  await Promise.all([
    admin.from('bag_transactions').delete().eq('user_id', userId),
    admin.from('payments').delete().eq('user_id', userId),
    bag ? admin.from('class_bag').delete().eq('user_id', userId) : Promise.resolve(),
  ])

  await Promise.all([
    admin.from('bookings').delete().eq('student_id', userId),
    admin.from('group_enrollments').delete().eq('student_id', userId),
    admin.from('chat_threads').delete().eq('user_id', userId),
    admin.from('materials').delete().eq('uploaded_by', userId),
    admin.from('student_checklists').delete().eq('student_id', userId),
  ])

  // Paso 4: borrar el usuario
  const { error: deleteErr } = await admin.from('users').delete().eq('id', userId)
  if (deleteErr) return NextResponse.json({ error: 'Error al eliminar el usuario' }, { status: 500 })

  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr && !authErr.message.toLowerCase().includes('not found')) {
    return NextResponse.json({ error: 'Error al eliminar la cuenta de autenticación' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
