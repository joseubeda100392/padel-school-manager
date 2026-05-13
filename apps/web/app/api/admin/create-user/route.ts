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
    return NextResponse.json({ error: 'Solo los administradores pueden crear usuarios' }, { status: 403 })
  }

  const { email, name, role, levelId, tempPassword, clubIdOverride } = await req.json()
  const clubId = clubIdOverride ?? caller.club_id

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name, role, club_id: clubId },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const { error: dbError } = await admin.from('users').insert({
    id: authData.user.id,
    email,
    name,
    role,
    club_id: clubId,
    current_level_id: levelId || null,
  })

  if (dbError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  if (role === 'student') {
    await admin.from('class_bag').upsert({
      user_id: authData.user.id,
      club_id: clubId,
      balance: 0,
    }, { onConflict: 'user_id' })
  }

  if (levelId) {
    await admin.from('user_levels').insert({
      user_id: authData.user.id,
      level_id: levelId,
      assigned_by: user.id,
    })
  }

  return NextResponse.json({ data: { id: authData.user.id } })
}
