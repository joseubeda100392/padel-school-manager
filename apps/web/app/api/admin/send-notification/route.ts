export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
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

  const { title, body, filterLevelId } = await req.json()
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Título y mensaje son obligatorios' }, { status: 400 })
  }

  const cookieStore = cookies()
  const clubId = caller.role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? caller.club_id)
    : caller.club_id

  let query = admin
    .from('users')
    .select('id, push_token')
    .eq('role', 'student')
    .not('push_token', 'is', null)

  if (clubId) query = query.eq('club_id', clubId)
  if (filterLevelId) query = query.eq('current_level_id', filterLevelId)

  const { data: recipients } = await query
  const tokens = (recipients ?? []).map((r: any) => r.push_token).filter(Boolean)

  const messages = tokens.map((token: string) => ({
    to: token,
    title,
    body,
    sound: 'default',
  }))

  let sent = 0
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100)
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    })
    sent += batch.length
  }

  await admin.from('push_campaigns').insert({
    club_id: clubId,
    title,
    body,
    filter_level_id: filterLevelId || null,
    sent_count: sent,
    sent_by: user.id,
  })

  return NextResponse.json({ ok: true, sent })
}
