export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push'
import { formatTime } from '@/lib/utils'

async function notifySpotAvailable(admin: ReturnType<typeof getAdminClient>, scheduleId: string, excludedDate: string) {
  try {
    const { data: scheduleData } = await admin
      .from('schedules')
      .select('start_time, club_id, court:courts(name), level:levels(name)')
      .eq('id', scheduleId)
      .single()

    const { data: enrolledRows } = await admin
      .from('group_enrollments')
      .select('student_id')
      .eq('schedule_id', scheduleId)
      .eq('status', 'active')

    const excludedIds = new Set((enrolledRows ?? []).map((e: any) => e.student_id))
    const clubId = (scheduleData as any)?.club_id

    const q = admin.from('users').select('id').eq('role', 'student').eq('is_active', true)
    const { data: candidates } = await (clubId ? q.eq('club_id', clubId) : q)
    const targetIds = (candidates ?? []).map((u: any) => u.id).filter((id: string) => !excludedIds.has(id))

    if (!targetIds.length || !scheduleData) return

    const sc = scheduleData as any
    const startDt = new Date(sc.start_time)
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const timeStr = formatTime(startDt)
    const levelName = sc.level?.name ? ` · ${sc.level.name}` : ''
    const dateLabel = new Date(excludedDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

    await sendPushToUsers(targetIds, {
      title: '🎾 ¡Hueco libre disponible!',
      body: `${dayNames[startDt.getDay()]} ${dateLabel} a las ${timeStr}${levelName} — ${sc.court?.name ?? ''}`,
      url: '/student/spots',
    }, 'spot_available')
  } catch {
    // No interrumpir la respuesta si falla el push
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: adminUser } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { group_enrollment_id, excluded_date, reason, publish_spot } = await req.json()

  const { data: enrollment } = await admin
    .from('group_enrollments')
    .select('student_id, schedule_id')
    .eq('id', group_enrollment_id)
    .single()

  const { data, error } = await admin.from('schedule_exclusions').insert({
    group_enrollment_id,
    excluded_date,
    reason: reason || null,
    publish_spot: publish_spot ?? false,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (publish_spot && enrollment?.schedule_id) {
    await notifySpotAvailable(admin, enrollment.schedule_id, excluded_date)
  }

  let newBagBalance: number | null = null
  if (enrollment?.student_id) {
    const { data: bag } = await admin.from('class_bag').select('id, balance').eq('user_id', enrollment.student_id).single()
    if (bag) {
      newBagBalance = bag.balance + 1
      await admin.from('class_bag').update({ balance: newBagBalance, updated_at: new Date().toISOString() }).eq('id', bag.id)
      await admin.from('bag_transactions').insert({
        user_id: enrollment.student_id,
        class_bag_id: bag.id,
        delta: 1,
        type: 'credit',
        reason: `Falta registrada ${excluded_date}`,
      })
    }
  }

  return NextResponse.json({ data, newBagBalance })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: adminUser } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id, publish_spot } = await req.json()

  const { data: exclusionBefore } = await admin
    .from('schedule_exclusions')
    .select('excluded_date, group_enrollment_id, publish_spot')
    .eq('id', id)
    .single()

  const { error } = await admin.from('schedule_exclusions').update({ publish_spot }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si se está publicando (era false y ahora true), notificar
  if (publish_spot && !exclusionBefore?.publish_spot && exclusionBefore?.group_enrollment_id) {
    const { data: ge } = await admin
      .from('group_enrollments')
      .select('schedule_id')
      .eq('id', exclusionBefore.group_enrollment_id)
      .single()
    if (ge?.schedule_id) {
      await notifySpotAvailable(admin, ge.schedule_id, exclusionBefore.excluded_date)
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: adminUser } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await req.json()

  const { data: exclusion } = await admin
    .from('schedule_exclusions')
    .select('group_enrollment_id')
    .eq('id', id)
    .single()

  await admin.from('schedule_exclusions').delete().eq('id', id)

  if (exclusion?.group_enrollment_id) {
    const { data: enrollment } = await admin
      .from('group_enrollments')
      .select('student_id')
      .eq('id', exclusion.group_enrollment_id)
      .single()

    if (enrollment?.student_id) {
      const { data: bag } = await admin.from('class_bag').select('id, balance').eq('user_id', enrollment.student_id).single()
      if (bag && bag.balance > 0) {
        await admin.from('class_bag').update({ balance: bag.balance - 1, updated_at: new Date().toISOString() }).eq('id', bag.id)
        await admin.from('bag_transactions').insert({
          user_id: enrollment.student_id,
          class_bag_id: bag.id,
          delta: -1,
          type: 'debit',
          reason: 'Falta cancelada',
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
