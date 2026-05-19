export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: adminUser } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (adminUser.role !== 'super_admin') {
    const { data: enrollment } = await admin.from('group_enrollments').select('club_id').eq('id', params.id).single()
    if (!enrollment || enrollment.club_id !== adminUser.club_id) {
      return NextResponse.json({ error: 'Inscripción no pertenece a tu club' }, { status: 403 })
    }
  }

  const body = await req.json()
  const { error } = await admin
    .from('group_enrollments')
    .update({ monthly_price: body.monthly_price })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: adminUser } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (adminUser.role !== 'super_admin') {
    const { data: enrollment } = await admin.from('group_enrollments').select('club_id').eq('id', params.id).single()
    if (!enrollment || enrollment.club_id !== adminUser.club_id) {
      return NextResponse.json({ error: 'Inscripción no pertenece a tu club' }, { status: 403 })
    }
  }

  await admin.from('group_enrollments').update({ status: 'cancelled' }).eq('id', params.id)
  return NextResponse.json({ ok: true })
}
