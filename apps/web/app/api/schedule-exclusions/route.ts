export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const adminSupabase = () => createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = adminSupabase()
  const { data: adminUser } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { group_enrollment_id, excluded_date, reason, publish_spot } = await req.json()

  const { data: enrollment } = await admin
    .from('group_enrollments')
    .select('student_id')
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

  if (enrollment?.student_id) {
    const { data: bag } = await admin.from('class_bag').select('id, balance').eq('user_id', enrollment.student_id).single()
    if (bag) {
      await admin.from('class_bag').update({ balance: bag.balance + 1, updated_at: new Date().toISOString() }).eq('id', bag.id)
      await admin.from('bag_transactions').insert({
        user_id: enrollment.student_id,
        class_bag_id: bag.id,
        delta: 1,
        type: 'credit',
        reason: `Falta registrada ${excluded_date}`,
      })
    }
  }

  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = adminSupabase()
  const { data: adminUser } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id, publish_spot } = await req.json()
  const { error } = await admin.from('schedule_exclusions').update({ publish_spot }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await req.json()
  const admin = adminSupabase()
  await admin.from('schedule_exclusions').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
