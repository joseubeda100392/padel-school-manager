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

  if (caller.role !== 'super_admin' && caller.club_id) {
    const { data: target } = await admin
      .from('users')
      .select('club_id')
      .eq('id', userId)
      .single()

    if (!target || target.club_id !== caller.club_id) {
      return NextResponse.json({ error: 'Sin permisos para eliminar este usuario' }, { status: 403 })
    }
  }

  await admin.from('user_levels').delete().eq('user_id', userId)

  const { data: bag } = await admin.from('class_bag').select('id').eq('user_id', userId).maybeSingle()
  if (bag) {
    await admin.from('bag_transactions').delete().eq('class_bag_id', bag.id)
    await admin.from('class_bag').delete().eq('user_id', userId)
  }

  await admin.from('bookings').delete().eq('student_id', userId)
  await admin.from('group_enrollments').delete().eq('student_id', userId)
  await admin.from('notifications').delete().eq('user_id', userId)
  await admin.from('chat_messages').delete().eq('sender_id', userId)
  await admin.from('users').delete().eq('id', userId)

  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr) {
    return NextResponse.json({ error: `Error eliminando cuenta Auth: ${authErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
