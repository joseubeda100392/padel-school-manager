export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const body = await req.json()
    const { name, email, password, clubId } = body

    if (!name || !email || !password || !clubId) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    // Verificar que el club existe y está activo
    const { data: club, error: clubError } = await adminSupabase
      .from('clubs')
      .select('id, is_active')
      .eq('id', clubId)
      .single()

    if (clubError || !club || !club.is_active) {
      return NextResponse.json({ error: 'Club no válido o inactivo' }, { status: 400 })
    }

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'student', club_id: clubId },
    })

    if (authError) {
      const msg = authError.message.includes('already') || authError.message.includes('registered')
        ? 'Ese email ya está registrado'
        : authError.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const userId = authData.user.id

    // Crear registro en tabla users
    const { error: dbError } = await adminSupabase.from('users').insert({
      id: userId,
      email,
      name,
      role: 'student',
      club_id: clubId,
      is_active: true,
    })

    if (dbError) {
      await adminSupabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    // Crear bolsa de clases vacía (ignoramos error si ya existe)
    await adminSupabase.from('class_bag').upsert({
      user_id: userId,
      club_id: clubId,
      balance_60: 0,
      balance_90: 0,
    }, { onConflict: 'user_id' })

    return NextResponse.json({ data: { id: userId } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno del servidor' }, { status: 500 })
  }
}
