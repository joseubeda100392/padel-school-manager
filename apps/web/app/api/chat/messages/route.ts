export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { thread_id, content } = await req.json()
  if (!thread_id || !content?.trim()) {
    return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 })
  }

  const admin = getAdminClient()

  const { data: callerRole } = await admin.from('users').select('role').eq('id', user.id).single()
  const isAdmin = callerRole?.role === 'admin' || callerRole?.role === 'super_admin'

  if (!isAdmin) {
    const { data: thread } = await admin.from('chat_threads').select('user_id').eq('id', thread_id).single()
    if (!thread || thread.user_id !== user.id) {
      return NextResponse.json({ error: 'Sin acceso a este hilo' }, { status: 403 })
    }
  }

  const { data, error } = await admin
    .from('chat_messages')
    .insert({ thread_id, sender_id: user.id, content: content.trim() })
    .select('*, sender:users(name, role)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const thread_id = searchParams.get('thread_id')
  if (!thread_id) return NextResponse.json({ error: 'thread_id requerido' }, { status: 400 })

  const admin = getAdminClient()

  const { data: callerRole } = await admin.from('users').select('role').eq('id', user.id).single()
  const isAdmin = callerRole?.role === 'admin' || callerRole?.role === 'super_admin'

  if (!isAdmin) {
    const { data: thread } = await admin.from('chat_threads').select('user_id').eq('id', thread_id).single()
    if (!thread || thread.user_id !== user.id) {
      return NextResponse.json({ error: 'Sin acceso a este hilo' }, { status: 403 })
    }
  }

  const { data, error } = await admin
    .from('chat_messages')
    .select('*, sender:users(name, role)')
    .eq('thread_id', thread_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
