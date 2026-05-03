export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: NextRequest) {
  const serverSupabase = createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const role = user.user_metadata?.role
  if (role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const clubId = await getClubId() ?? user.user_metadata?.club_id
  if (!clubId) return NextResponse.json({ error: 'Club no identificado' }, { status: 400 })

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: club } = await adminSupabase.from('clubs').select('id').eq('id', clubId).single()
  if (!club) return NextResponse.json({ error: 'Club no válido' }, { status: 400 })

  const { data: levels } = await adminSupabase.from('levels').select('id, name').eq('club_id', clubId)
  const levelByName: Record<string, string> = {}
  ;(levels ?? []).forEach((l: any) => { levelByName[l.name.toLowerCase().trim()] = l.id })

  const { rows }: { rows: { nombre: string; email: string; telefono?: string; nivel?: string; password?: string }[] } = await req.json()

  const results = []

  for (const row of rows) {
    const name = row.nombre?.trim()
    const email = row.email?.trim().toLowerCase()

    if (!name || !email) {
      results.push({ email: email ?? '—', status: 'error', error: 'Nombre o email vacío' })
      continue
    }

    const password = row.password?.trim() || generatePassword()
    const levelId = row.nivel ? (levelByName[row.nivel.toLowerCase().trim()] ?? null) : null

    try {
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: 'student', club_id: clubId },
      })

      if (authError) {
        const msg = authError.message.toLowerCase().includes('already')
          ? 'Email ya registrado'
          : authError.message
        results.push({ email, name, status: 'error', error: msg })
        continue
      }

      const userId = authData.user.id

      await adminSupabase.from('users').insert({
        id: userId,
        email,
        name,
        phone: row.telefono?.trim() || null,
        role: 'student',
        club_id: clubId,
        is_active: true,
        current_level_id: levelId,
      })

      await adminSupabase.from('class_bag').upsert(
        { user_id: userId, club_id: clubId, balance: 0 },
        { onConflict: 'user_id' }
      )

      results.push({ email, name, status: 'ok', password })
    } catch (e: any) {
      results.push({ email, name, status: 'error', error: e?.message ?? 'Error desconocido' })
    }
  }

  return NextResponse.json({ results })
}
