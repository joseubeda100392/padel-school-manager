export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/push'

const PREVIEW_CHARS = 120

// Aviso al móvil del otro lado de la conversación: si escribe quien abrió el
// hilo (alumno o monitor), al monitor del hilo o, si es con el club, a los
// admins del club; si contesta el club o el monitor, a quien abrió el hilo.
// Nunca debe impedir que el mensaje se envíe.
async function notifyRecipients(admin: ReturnType<typeof getAdminClient>, threadId: string, senderId: string, senderName: string, content: string) {
  const { data: thread } = await admin.from('chat_threads').select('user_id, recipient_id, club_id, owner:users!chat_threads_user_id_fkey(role)').eq('id', threadId).single()
  if (!thread) return
  let recipients: string[] = []
  let url = '/dashboard/chat'
  if (senderId === thread.user_id) {
    if (thread.recipient_id) {
      recipients = [thread.recipient_id]
      url = '/coach/chat'
    } else if (thread.club_id) {
      const { data: admins } = await admin.from('users').select('id').eq('club_id', thread.club_id).eq('role', 'admin').eq('is_active', true)
      recipients = (admins ?? []).map(a => a.id)
    }
  } else {
    recipients = [thread.user_id]
    url = (thread as any).owner?.role === 'coach' ? '/coach/chat' : '/student/chat'
  }
  recipients = recipients.filter(id => id !== senderId)
  if (!recipients.length) return
  const preview = content.length > PREVIEW_CHARS ? `${content.slice(0, PREVIEW_CHARS)}…` : content
  await sendPushToUsers(recipients, { title: `💬 Mensaje de ${senderName}`, body: preview, url }, 'chat_message')
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    thread_id: z.string().uuid(),
    content: z.string().min(1).max(2000),
  }))
  if (badRequest) return badRequest
  const { thread_id, content } = body

  const admin = getAdminClient()

  const { data: callerRole } = await admin.from('users').select('role').eq('id', user.id).single()
  const role = callerRole?.role ?? ''
  const isAdmin = role === 'admin' || role === 'super_admin'
  const isCoach = role === 'coach'

  if (!isAdmin) {
    const { data: thread } = await admin.from('chat_threads').select('user_id, recipient_id').eq('id', thread_id).single()
    if (!thread) return NextResponse.json({ error: 'Sin acceso a este hilo' }, { status: 403 })
    const isOwner = thread.user_id === user.id
    const isRecipient = isCoach && thread.recipient_id === user.id
    if (!isOwner && !isRecipient) {
      return NextResponse.json({ error: 'Sin acceso a este hilo' }, { status: 403 })
    }
  }

  const { data, error } = await admin
    .from('chat_messages')
    .insert({ thread_id, sender_id: user.id, content: content.trim() })
    .select('*, sender:users(name, role)')
    .single()

  if (error) return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })

  try {
    await notifyRecipients(admin, thread_id, user.id, (data as any)?.sender?.name ?? 'Tu club', content.trim())
  } catch (err) {
    console.error('[chat] push notification failed:', err)
  }
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
  const role = callerRole?.role ?? ''
  const isAdmin = role === 'admin' || role === 'super_admin'
  const isCoach = role === 'coach'

  if (!isAdmin) {
    const { data: thread } = await admin.from('chat_threads').select('user_id, recipient_id').eq('id', thread_id).single()
    if (!thread) return NextResponse.json({ error: 'Sin acceso a este hilo' }, { status: 403 })
    const isOwner = thread.user_id === user.id
    const isRecipient = isCoach && thread.recipient_id === user.id
    if (!isOwner && !isRecipient) {
      return NextResponse.json({ error: 'Sin acceso a este hilo' }, { status: 403 })
    }
  }

  const { data, error } = await admin
    .from('chat_messages')
    .select('*, sender:users(name, role)')
    .eq('thread_id', thread_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  return NextResponse.json({ data })
}
