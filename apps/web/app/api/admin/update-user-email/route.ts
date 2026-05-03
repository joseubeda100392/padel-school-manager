export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: caller } = await adminSupabase
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

  const { error: authError } = await adminSupabase.auth.admin.updateUserById(userId, { email: newEmail })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  await adminSupabase.from('users').update({ email: newEmail }).eq('id', userId)

  return NextResponse.json({ ok: true })
}
