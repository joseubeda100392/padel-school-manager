export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()

  const { data: caller } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin' && caller?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { userId, email } = await req.json()
  if (!userId || !email?.trim()) {
    return NextResponse.json({ error: 'userId y email son obligatorios' }, { status: 400 })
  }

  const newEmail = email.trim().toLowerCase()

  const { error: authError } = await admin.auth.admin.updateUserById(userId, { email: newEmail })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  await admin.from('users').update({ email: newEmail }).eq('id', userId)

  return NextResponse.json({ ok: true })
}
