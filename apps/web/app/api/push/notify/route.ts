export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPushToUsers } from '@/lib/push'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const role = user.user_metadata?.role as string | undefined
  if (!['admin', 'super_admin'].includes(role ?? '')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { title, body, url, target, levelId }: {
    title: string
    body: string
    url?: string
    target: 'all' | 'level' | 'payment_pending'
    levelId?: string
  } = await req.json()

  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Título y cuerpo requeridos' }, { status: 400 })
  }

  const { data: adminProfile } = await admin
    .from('users')
    .select('club_id')
    .eq('id', user.id)
    .single()
  const clubId = adminProfile?.club_id

  let userIds: string[] = []

  if (target === 'all') {
    const q = admin.from('users').select('id').eq('role', 'student').eq('is_active', true)
    const { data } = await (clubId ? q.eq('club_id', clubId) : q)
    userIds = (data ?? []).map(u => u.id)
  } else if (target === 'level' && levelId) {
    const q = admin.from('users').select('id').eq('role', 'student').eq('is_active', true).eq('current_level_id', levelId)
    const { data } = await (clubId ? q.eq('club_id', clubId) : q)
    userIds = (data ?? []).map(u => u.id)
  } else if (target === 'payment_pending') {
    const now = new Date()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    const q = admin
      .from('group_enrollments')
      .select('student_id')
      .eq('status', 'active')
      .or(`paid_until.is.null,paid_until.lt.${endOfMonth}`)
    const { data } = await q
    userIds = [...new Set((data ?? []).map(e => e.student_id))]
  }

  if (!userIds.length) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const notifType = target === 'payment_pending' ? 'payment_reminder' : 'admin_message'
  await sendPushToUsers(userIds, { title, body, url: url || '/student' }, notifType)

  return NextResponse.json({ ok: true, sent: userIds.length })
}
