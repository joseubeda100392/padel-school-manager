export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const adminSupabase = () => createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = adminSupabase()
  const { data: adminUser } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: enrollment } = await admin
    .from('group_enrollments')
    .select('student_id, monthly_price, club_id')
    .eq('id', params.id)
    .single()

  if (!enrollment) return NextResponse.json({ error: 'Inscripción no encontrada' }, { status: 404 })

  const now = new Date()
  const paidUntil = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const clubId = enrollment.club_id ?? adminUser.club_id

  await admin.from('group_enrollments').update({ paid_until: paidUntil }).eq('id', params.id)

  const { error: paymentError } = await admin.from('payments').insert({
    user_id: enrollment.student_id,
    club_id: clubId,
    amount: enrollment.monthly_price,
    type: 'fixed_group_month',
    status: 'completed',
    metadata: { enrollment_id: params.id, method: 'cash', paid_until: paidUntil },
  })

  if (paymentError) {
    console.error('[mark-paid] payment insert error:', paymentError)
    return NextResponse.json({ error: paymentError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, paidUntil })
}
