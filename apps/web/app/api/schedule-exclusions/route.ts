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
  let recoveryCapReached = false
  if (enrollment?.student_id && enrollment?.schedule_id) {
    const { data: sched } = await admin.from('schedules').select('start_time, end_time, club_id').eq('id', enrollment.schedule_id).single()
    const durationMin = sched ? Math.round((new Date(sched.end_time).getTime() - new Date(sched.start_time).getTime()) / 60000) : 60
    const durationType: '60' | '90' = durationMin >= 80 ? '90' : '60'

    const clubId = (sched as any)?.club_id ?? null
    let maxRecovery = 0
    if (clubId) {
      try {
        const { data: clubCfg } = await admin.from('clubs').select('config').eq('id', clubId).single()
        maxRecovery = (clubCfg as any)?.config?.max_recovery_classes ?? 0
      } catch { /* sin límite */ }
    }

    const { data: bag } = await admin.from('class_bag')
      .select('id, balance_60, balance_90, recovery_balance_60, recovery_balance_90')
      .eq('user_id', enrollment.student_id).single()

    if (bag) {
      const totalRecovery = (bag.recovery_balance_60 ?? 0) + (bag.recovery_balance_90 ?? 0)
      if (maxRecovery > 0 && totalRecovery >= maxRecovery) {
        recoveryCapReached = true
      } else {
        const newBal60 = durationType === '60' ? bag.balance_60 + 1 : bag.balance_60
        const newBal90 = durationType === '90' ? bag.balance_90 + 1 : bag.balance_90
        const newRec60 = durationType === '60' ? (bag.recovery_balance_60 ?? 0) + 1 : (bag.recovery_balance_60 ?? 0)
        const newRec90 = durationType === '90' ? (bag.recovery_balance_90 ?? 0) + 1 : (bag.recovery_balance_90 ?? 0)
        newBagBalance = newBal60 + newBal90
        await admin.from('class_bag').update({
          balance_60: newBal60,
          balance_90: newBal90,
          recovery_balance_60: newRec60,
          recovery_balance_90: newRec90,
          updated_at: new Date().toISOString(),
        }).eq('id', bag.id)
        await admin.from('bag_transactions').insert({
          user_id: enrollment.student_id,
          class_bag_id: bag.id,
          delta: 1,
          type: 'credit',
          reason: `Falta registrada ${excluded_date}`,
          class_duration: durationType,
        })
      }
    }
  }

  return NextResponse.json({ data, newBagBalance, recoveryCapReached })
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
    .select('group_enrollment_id, excluded_date')
    .eq('id', id)
    .single()

  await admin.from('schedule_exclusions').delete().eq('id', id)

  if (exclusion?.group_enrollment_id) {
    const { data: enrollment } = await admin
      .from('group_enrollments')
      .select('student_id, schedule_id')
      .eq('id', exclusion.group_enrollment_id)
      .single()

    if (enrollment?.student_id) {
      const { data: originalTx } = await admin
        .from('bag_transactions')
        .select('class_duration')
        .eq('user_id', enrollment.student_id)
        .eq('type', 'credit')
        .like('reason', `Falta registrada ${exclusion.excluded_date}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let durationType: '60' | '90' = originalTx?.class_duration === '90' ? '90' : '60'

      if (!originalTx && enrollment.schedule_id) {
        const { data: sched } = await admin
          .from('schedules')
          .select('start_time, end_time')
          .eq('id', enrollment.schedule_id)
          .single()
        if (sched) {
          const durationMin = Math.round(
            (new Date(sched.end_time).getTime() - new Date(sched.start_time).getTime()) / 60000
          )
          durationType = durationMin >= 80 ? '90' : '60'
        }
      }

      const { data: bag } = await admin.from('class_bag').select('id, balance_60, balance_90').eq('user_id', enrollment.student_id).single()
      if (bag && (bag.balance_60 > 0 || bag.balance_90 > 0)) {
        const newBal60 = durationType === '60' ? Math.max(0, bag.balance_60 - 1) : bag.balance_60
        const newBal90 = durationType === '90' ? Math.max(0, bag.balance_90 - 1) : bag.balance_90
        await admin.from('class_bag').update({ balance_60: newBal60, balance_90: newBal90, updated_at: new Date().toISOString() }).eq('id', bag.id)
        await admin.from('bag_transactions').insert({
          user_id: enrollment.student_id,
          class_bag_id: bag.id,
          delta: -1,
          type: 'debit',
          reason: 'Falta cancelada',
          class_duration: durationType,
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
