export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: caller } = await adminSupabase
    .from('users')
    .select('role, club_id')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin' && caller?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Solo los administradores pueden crear usuarios' }, { status: 403 })
  }

  const { email, name, role, levelId, clubIdOverride } = await req.json()
  const clubId = clubIdOverride ?? caller.club_id

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`

  // Invitar usuario — recibirá email para establecer su contraseña
  const { data: authData, error: authError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/dashboard`,
    data: { name, role, club_id: clubId },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Crear registro en tabla users
  const { error: dbError } = await adminSupabase.from('users').insert({
    id: authData.user.id,
    email,
    name,
    role,
    club_id: clubId,
    current_level_id: levelId || null,
    email_confirmed: false,
  })

  if (dbError) {
    await adminSupabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  if (role === 'student') {
    await adminSupabase.from('class_bag').upsert({
      user_id: authData.user.id,
      club_id: clubId,
      balance: 0,
    }, { onConflict: 'user_id' })
  }

  if (levelId) {
    await adminSupabase.from('user_levels').insert({
      user_id: authData.user.id,
      level_id: levelId,
      assigned_by: user.id,
    })
  }

  return NextResponse.json({ data: { id: authData.user.id } })
}
