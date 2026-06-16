export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const clubId = params.id
  const admin = getAdminClient()

  const { data: club } = await admin.from('clubs').select('id').eq('id', clubId).single()
  if (!club) return NextResponse.json({ error: 'Club no encontrado' }, { status: 404 })

  // Obtener IDs de usuarios del club antes de borrar
  const { data: clubUsers } = await admin.from('users').select('id').eq('club_id', clubId)
  const userIds = (clubUsers ?? []).map((u: any) => u.id)

  // Obtener IDs de schedules del club
  const { data: clubSchedules } = await admin.from('schedules').select('id').eq('club_id', clubId)
  const scheduleIds = (clubSchedules ?? []).map((s: any) => s.id)

  // Obtener IDs de group_enrollments de esos schedules
  const { data: enrollments } = scheduleIds.length
    ? await admin.from('group_enrollments').select('id').in('schedule_id', scheduleIds)
    : { data: [] }
  const enrollmentIds = (enrollments ?? []).map((e: any) => e.id)

  // Obtener IDs de materiales del club
  const { data: clubMaterials } = await admin.from('materials').select('id').eq('club_id', clubId)
  const materialIds = (clubMaterials ?? []).map((m: any) => m.id)

  // Obtener IDs de chat_threads del club
  const { data: threads } = await admin.from('chat_threads').select('id').eq('club_id', clubId)
  const threadIds = (threads ?? []).map((t: any) => t.id)

  // Borrar en orden respetando FK
  if (enrollmentIds.length) {
    await admin.from('schedule_exclusions').delete().in('group_enrollment_id', enrollmentIds)
    await admin.from('group_enrollments').delete().in('id', enrollmentIds)
  }

  if (scheduleIds.length) {
    await admin.from('bookings').delete().in('schedule_id', scheduleIds)
    await admin.from('schedules').delete().in('id', scheduleIds)
  }

  if (materialIds.length) {
    await admin.from('material_levels').delete().in('material_id', materialIds)
    await admin.from('materials').delete().in('id', materialIds)
  }

  if (threadIds.length) {
    await admin.from('chat_messages').delete().in('thread_id', threadIds)
    await admin.from('chat_threads').delete().in('id', threadIds)
  }

  if (userIds.length) {
    await admin.from('bag_transactions').delete().in('user_id', userIds)
    await admin.from('user_levels').delete().in('user_id', userIds)
  }

  await admin.from('notifications').delete().eq('club_id', clubId)
  await admin.from('payments').delete().eq('club_id', clubId)
  await admin.from('class_bag').delete().eq('club_id', clubId)
  await admin.from('courts').delete().eq('club_id', clubId)
  await admin.from('levels').delete().eq('club_id', clubId)
  await admin.from('users').delete().eq('club_id', clubId)

  // Borrar usuarios de Supabase Auth
  for (const uid of userIds) {
    await admin.auth.admin.deleteUser(uid)
  }

  await admin.from('clubs').delete().eq('id', clubId)

  return NextResponse.json({ ok: true })
}
