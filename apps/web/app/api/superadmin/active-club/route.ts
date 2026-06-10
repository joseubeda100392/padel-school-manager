import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { clubId } = await request.json()
  if (!clubId || typeof clubId !== 'string') {
    return NextResponse.json({ error: 'clubId requerido' }, { status: 400 })
  }

  const { data: club } = await admin.from('clubs').select('id').eq('id', clubId).single()
  if (!club) return NextResponse.json({ error: 'Club no encontrado' }, { status: 404 })

  const cookieStore = cookies()
  cookieStore.set('sa_active_club', clubId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cookieStore = cookies()
  cookieStore.delete('sa_active_club')

  return NextResponse.json({ ok: true })
}
