export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

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
    const { data: target } = await admin
      .from('users')
      .select('club_id')
      .eq('id', userId)
      .single()

    if (!target || !caller.club_id || target.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos para eliminar este usuario' }, { status: 403 })
    }
  }

  // Bloquear borrado si el usuario es monitor con clases activas que tienen alumnos
  const { data: coachActiveSchedules } = await admin
    .from('schedules')
    .select('id')
    .eq('coach_id', userId)
    .eq('is_active', true)
    .limit(1)
  if (coachActiveSchedules && coachActiveSchedules.length > 0) {
    return NextResponse.json({ error: 'Este monitor tiene clases asignadas. Reasígnalas antes de eliminarlo.' }, { status: 409 })
  }

  // --- Nullear FKs nullable ---
  await admin.from('chat_threads').update({ recipient_id: null }).eq('recipient_id', userId)
  await admin.from('schedule_exclusions').update({ created_by: null }).eq('created_by', userId)
  await admin.from('makeups').update({ created_by: null }).eq('created_by', userId)
  await admin.from('pista_viva_campaigns').update({ created_by: null }).eq('created_by', userId)
  await admin.from('pista_viva_clicks').update({ user_id: null }).eq('user_id', userId)
  await admin.from('group_enrollments').update({ enrolled_by: null }).eq('enrolled_by', userId)
  await admin.from('push_campaigns').update({ sent_by: null }).eq('sent_by', userId)
  await admin.from('student_checklists').update({ coach_id: null }).eq('coach_id', userId)
  await admin.from('student_checklists').update({ completed_by_id: null }).eq('completed_by_id', userId)
  await admin.from('checklist_items').update({ completed_by_id: null }).eq('completed_by_id', userId)

  // --- Borrar horarios del monitor en cascada ---
  // coach_id es NOT NULL en schedules, no se puede nullear — hay que borrar los horarios
  const { data: mySchedules } = await admin.from('schedules').select('id').eq('coach_id', userId)
  if (mySchedules && mySchedules.length > 0) {
    const scheduleIds = mySchedules.map((s: any) => s.id)

    // Limpiar enrollments (y sus exclusiones) ligados a estos horarios
    const { data: schedEnrollments } = await admin
      .from('group_enrollments')
      .select('id')
      .in('schedule_id', scheduleIds)
    if (schedEnrollments && schedEnrollments.length > 0) {
      const enrollIds = schedEnrollments.map((e: any) => e.id)
      await admin.from('schedule_exclusions').delete().in('group_enrollment_id', enrollIds)
      await admin.from('group_enrollments').delete().in('id', enrollIds)
    }

    // Limpiar bookings (y sus transacciones/pagos) ligados a estos horarios
    const { data: schedBookings } = await admin
      .from('bookings')
      .select('id')
      .in('schedule_id', scheduleIds)
    if (schedBookings && schedBookings.length > 0) {
      const bookingIds = schedBookings.map((b: any) => b.id)
      await admin.from('bag_transactions').delete().in('booking_id', bookingIds)
      await admin.from('payments').delete().in('booking_id', bookingIds)
      await admin.from('bookings').delete().in('id', bookingIds)
    }

    await admin.from('schedule_exclusions').delete().in('schedule_id', scheduleIds)
    await admin.from('schedules').delete().in('id', scheduleIds)
  }

  // --- Borrar filas dependientes ---
  await admin.from('user_levels').delete().eq('user_id', userId)
  await admin.from('push_subscriptions').delete().eq('user_id', userId)
  await admin.from('admin_recovery_codes').delete().eq('user_id', userId)
  await admin.from('tournament_registrations').delete().eq('student_id', userId)
  await admin.from('payment_mandates').delete().eq('user_id', userId)
  await admin.from('makeups').delete().eq('student_id', userId)

  // Borrar exclusiones antes de enrollments
  const { data: enrollments } = await admin.from('group_enrollments').select('id').eq('student_id', userId)
  if (enrollments && enrollments.length > 0) {
    const enrollmentIds = enrollments.map((e: any) => e.id)
    await admin.from('schedule_exclusions').delete().in('group_enrollment_id', enrollmentIds)
  }

  // Borrar bag_transactions y payments antes de bookings
  const { data: studentBookings } = await admin.from('bookings').select('id').eq('student_id', userId)
  if (studentBookings && studentBookings.length > 0) {
    const bookingIds = studentBookings.map((b: any) => b.id)
    await admin.from('bag_transactions').delete().in('booking_id', bookingIds)
    await admin.from('payments').delete().in('booking_id', bookingIds)
  }

  const { data: bag } = await admin.from('class_bag').select('id').eq('user_id', userId).maybeSingle()
  if (bag) {
    await admin.from('bag_transactions').delete().eq('class_bag_id', bag.id)
    await admin.from('class_bag').delete().eq('user_id', userId)
  }

  await admin.from('bag_transactions').delete().eq('user_id', userId)
  await admin.from('payments').delete().eq('user_id', userId)
  await admin.from('bookings').delete().eq('student_id', userId)
  await admin.from('group_enrollments').delete().eq('student_id', userId)
  await admin.from('notifications').delete().eq('user_id', userId)
  await admin.from('chat_messages').delete().eq('sender_id', userId)
  await admin.from('chat_threads').delete().eq('user_id', userId)
  await admin.from('materials').delete().eq('uploaded_by', userId)
  const { data: checklists } = await admin.from('student_checklists').select('id').eq('student_id', userId)
  if (checklists && checklists.length > 0) {
    await admin.from('checklist_items').delete().in('checklist_id', checklists.map((c: any) => c.id))
  }
  await admin.from('student_checklists').delete().eq('student_id', userId)
  const { error: deleteErr } = await admin.from('users').delete().eq('id', userId)
  if (deleteErr) return NextResponse.json({ error: 'Error al eliminar el usuario' }, { status: 500 })

  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr && !authErr.message.toLowerCase().includes('not found')) {
    return NextResponse.json({ error: 'Error al eliminar la cuenta de autenticación' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
