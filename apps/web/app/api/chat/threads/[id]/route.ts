export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

async function requireAdmin(user: { id: string }) {
  const admin = getAdminClient()
  const { data } = await admin.from('users').select('role').eq('id', user.id).single()
  return data && ['admin', 'super_admin'].includes(data.role) ? admin : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = await requireAdmin(user)
  if (!admin) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { status } = await req.json()
  const { error } = await admin.from('chat_threads').update({ status }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = await requireAdmin(user)
  if (!admin) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  await admin.from('chat_messages').delete().eq('thread_id', params.id)
  await admin.from('chat_threads').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}
