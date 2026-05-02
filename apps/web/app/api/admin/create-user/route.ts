export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  // Verificar que quien llama es admin
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: caller } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo los administradores pueden crear usuarios' }, { status: 403 })
  }

  const { email, name, role, levelId, tempPassword } = await req.json()

  // Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name, role },
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
    current_level_id: levelId || null,
  })

  if (dbError) {
    // Limpiar usuario de Auth si falla la BD
    await adminSupabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  // Crear bolsa de clases vacía para alumnos siempre
  if (role === 'student') {
    await adminSupabase.from('class_bag').insert({
      user_id: authData.user.id,
      balance: 0,
    })
  }

  // Guardar nivel inicial en historial si se asignó
  if (levelId) {
    await adminSupabase.from('user_levels').insert({
      user_id: authData.user.id,
      level_id: levelId,
      assigned_by: user.id,
    })
  }

  return NextResponse.json({ data: { id: authData.user.id } })
}
