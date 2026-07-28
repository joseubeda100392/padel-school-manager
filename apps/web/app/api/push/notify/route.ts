export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, 'push-notify', { limit: 5, windowMs: 10 * 60 * 1000 })
  if (rl) return rl

  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const admin = getAdminClient()

    // DB role check is more reliable than user_metadata
    const { data: adminProfile } = await admin
      .from('users')
      .select('role, club_id')
      .eq('id', user.id)
      .single()

    if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const clubId = adminProfile.club_id

    const { title, body, url, target, levelId }: {
      title: string
      body: string
      url?: string
      target: 'all' | 'level' | 'payment_pending' | 'bag_pending'
      levelId?: string
    } = await req.json()

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Título y cuerpo requeridos' }, { status: 400 })
    }

    let userIds: string[] = []

    if (target === 'all') {
      let q = admin.from('users').select('id').eq('role', 'student').eq('is_active', true).limit(10000)
      const { data } = await (clubId ? q.eq('club_id', clubId) : q)
      userIds = (data ?? []).map((u: any) => u.id)

    } else if (target === 'level' && levelId) {
      let q = admin.from('users').select('id').eq('role', 'student').eq('is_active', true).eq('current_level_id', levelId).limit(10000)
      const { data } = await (clubId ? q.eq('club_id', clubId) : q)
      userIds = (data ?? []).map((u: any) => u.id)

    } else if (target === 'payment_pending') {
      const now = new Date()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

      let q = admin
        .from('group_enrollments')
        .select('student_id')
        .eq('status', 'active')
        .or(`paid_until.is.null,paid_until.lt.${endOfMonth}`)
        .limit(10000)

      if (clubId) q = q.eq('club_id', clubId)

      const { data } = await q
      userIds = [...new Set((data ?? []).map((e: any) => e.student_id))]

    } else if (target === 'bag_pending') {
      let q = admin
        .from('class_bag')
        .select('user_id')
        .or('balance_60.gt.0,balance_90.gt.0')
        .limit(10000)

      if (clubId) q = q.eq('club_id', clubId)
      const { data } = await q
      userIds = (data ?? []).map((b: any) => b.user_id)
    }

    if (!userIds.length) {
      return NextResponse.json({ ok: true, sent: 0, message: 'No hay destinatarios' })
    }

    const notifType = target === 'payment_pending' ? 'payment_reminder'
      : target === 'bag_pending' ? 'bag_reminder'
      : 'admin_message'
    await sendPushToUsers(userIds, { title, body, url: url || '/student' }, notifType)

    return NextResponse.json({ ok: true, sent: userIds.length })

  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
