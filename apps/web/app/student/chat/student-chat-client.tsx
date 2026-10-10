'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SendHorizontal } from 'lucide-react'
import { formatClock, formatLongDate } from '@/lib/format-date'
import { useConfirm } from '@/components/ui/confirm'
import { Avatar } from '@/components/ui/list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'

interface Message {
  id: string
  content: string
  created_at: string
  sender: { name: string; role: string } | null
  sender_id: string
}

interface Props {
  threadId: string
  threadStatus: string
  initialMessages: Message[]
  currentUserId: string
  recipientLabel?: string
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return formatLongDate(dateStr, { weekday: false })
}

export function StudentChatClient({ threadId, threadStatus, initialMessages, currentUserId, recipientLabel = 'Soporte' }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const inputId = useId()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel(`student-thread-${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        async (payload) => {
          const { data } = await supabase
            .from('chat_messages')
            .select('*, sender:users(name, role)')
            .eq('id', payload.new.id)
            .single()
          if (data) setMessages(prev => [...prev, data as Message])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [threadId])

  async function send() {
    if (!text.trim()) return
    setSending(true)
    await supabase.from('chat_messages').insert({
      thread_id: threadId,
      sender_id: currentUserId,
      content: text.trim(),
    })
    setText('')
    setSending(false)
  }

  async function deleteThread() {
    const ok = await confirm({
      title: '¿Eliminar esta conversación?',
      description: 'Se borrarán todos sus mensajes.',
      confirmLabel: 'Eliminar conversación',
      destructive: true,
    })
    if (!ok) return
    setDeleting(true)
    await supabase.from('chat_threads').delete().eq('id', threadId)
    router.refresh()
    router.push('/student/chat')
  }

  const grouped: { date: string; msgs: Message[] }[] = []
  for (const m of messages) {
    const label = formatDate(m.created_at)
    const last = grouped[grouped.length - 1]
    if (last && last.date === label) last.msgs.push(m)
    else grouped.push({ date: label, msgs: [m] })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={recipientLabel} />
          <div className="min-w-0">
            <h1 className="truncate text-heading text-ink">{recipientLabel}</h1>
            <p className="text-meta text-ink-3">
              {threadStatus === 'active' ? 'Te responderemos pronto' : 'Conversación resuelta'}
            </p>
          </div>
        </div>
        {threadStatus === 'resolved' && (
          <Button variant="danger-ghost" size="sm" onClick={deleteThread} loading={deleting}>
            Eliminar conversación
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 sm:p-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-body text-ink-3">
            Escríbenos lo que necesites y te responderemos pronto.
          </p>
        )}
        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-meta text-ink-3">{date}</span>
              <div className="h-px flex-1 bg-line" />
            </div>
            {msgs.map(m => {
              const isMe = m.sender_id === currentUserId
              return (
                <div key={m.id} className={`mb-2 flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-sm ${isMe ? 'bg-chrome text-white' : 'border border-line bg-surface text-ink'}`}>
                    {!isMe && (
                      <p className="mb-0.5 text-meta font-medium text-ink-2">{m.sender?.name ?? recipientLabel}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words text-body">{m.content}</p>
                    <p className={`mt-0.5 text-right text-meta tabular-nums ${isMe ? 'text-chrome-ink-2' : 'text-ink-3'}`}>
                      {formatClock(m.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line p-3 sm:p-4">
        {threadStatus === 'resolved' ? (
          <p className="text-center text-body text-ink-3">Esta conversación ha sido resuelta.</p>
        ) : (
          <div className="flex gap-2">
            <label htmlFor={inputId} className="sr-only">Mensaje</label>
            <Input
              id={inputId}
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Escribe un mensaje"
              autoComplete="off"
              enterKeyHint="send"
              className="min-w-0 flex-1"
            />
            <Button onClick={send} disabled={!text.trim()} loading={sending} aria-label="Enviar mensaje">
              <SendHorizontal className="h-4 w-4" aria-hidden />
              Enviar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
