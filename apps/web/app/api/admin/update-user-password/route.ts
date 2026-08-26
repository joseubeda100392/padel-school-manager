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
    .select('role, club_id')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin' && caller?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { userId, password } = await req.json()
  if (!userId || !password || password.length < 6) {
    return NextResponse.json({ error: 'userId y una contraseña de al menos 6 caracteres son obligatorios' }, { status: 400 })
  }

  const { data: target } = await admin.from('users').select('club_id').eq('id', userId).single()
  if (!target || (caller.role !== 'super_admin' && target.club_id !== caller.club_id)) {
    return NextResponse.json({ error: 'Usuario no pertenece a tu club' }, { status: 403 })
  }

  const { error: authError } = await admin.auth.admin.updateUserById(userId, { password })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { error: dbError } = await admin.from('users').update({ force_password_change: true }).eq('id', userId)
  if (dbError) console.error('[update-user-password] force_password_change flag update failed:', dbError.message)

  return NextResponse.json({ ok: true })
}
