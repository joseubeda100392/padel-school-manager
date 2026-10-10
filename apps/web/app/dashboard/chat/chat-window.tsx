'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { useConfirm } from '@/components/ui/confirm'
import { formatLongDate, formatClock } from '@/lib/format-date'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  content: string
  created_at: string
  sender: { name: string; role: string } | null
  sender_id: string
}

interface Thread {
  id: string
  status: string
  user: { name: string; email: string } | null
}

interface Props {
  thread: Thread
  initialMessages: Message[]
  currentUserId: string
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return formatLongDate(d, { weekday: false })
}

export function ChatWindow({ thread, initialMessages, currentUserId }: Props) {
  const confirm = useConfirm()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const poll = useCallback(async () => {
    const res = await fetch(`/api/chat/messages?thread_id=${thread.id}`)
    if (!res.ok) return
    const { data } = await res.json()
    if (data) setMessages(data)
  }, [thread.id])

  // Poll for new messages every 8 seconds
  useEffect(() => {
    const interval = setInterval(poll, 8000)
    return () => clearInterval(interval)
  }, [poll])

  async function send() {
    if (!text.trim()) return
    setSending(true)
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_id: thread.id, content: text.trim() }),
    })
    if (res.ok) {
      const { data } = await res.json()
      if (data) setMessages((prev) => [...prev, data as Message])
      setText('')
    }
    setSending(false)
  }

  async function resolve() {
    await fetch(`/api/chat/threads/${thread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    })
    window.location.href = '/dashboard/chat'
  }

  async function deleteThread() {
    if (
      !(await confirm({
        title: 'Eliminar esta conversación',
        description: 'Se borrarán todos los mensajes. No se puede deshacer.',
        confirmLabel: 'Eliminar conversación',
        destructive: true,
      }))
    )
      return
    setDeleting(true)
    await fetch(`/api/chat/threads/${thread.id}`, { method: 'DELETE' })
    window.location.href = '/dashboard/chat'
  }

  const grouped: { date: string; msgs: Message[] }[] = []
  for (const m of messages) {
    const label = formatDate(m.created_at)
    const last = grouped[grouped.length - 1]
    if (last && last.date === label) last.msgs.push(m)
    else grouped.push({ date: label, msgs: [m] })
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3 sm:p-4">
        <div className="min-w-0">
          <h2 className="truncate text-heading text-ink">{thread.user?.name ?? 'Desconocido'}</h2>
          <p className="truncate text-meta text-ink-3">{thread.user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {thread.status === 'active' && (
            <Button variant="secondary" size="sm" onClick={resolve}>
              Marcar resuelto
            </Button>
          )}
          <Button variant="danger-ghost" size="sm" onClick={deleteThread} loading={deleting}>
            Eliminar
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-label="Mensajes">
        {messages.length === 0 && (
          <p className="text-center text-body text-ink-2">Sin mensajes aún.</p>
        )}
        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-meta text-ink-3">{date}</span>
              <div className="h-px flex-1 bg-line" />
            </div>
            {msgs.map((m) => {
              const isMe = m.sender_id === currentUserId
              return (
                <div key={m.id} className={cn('mb-2 flex', isMe ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-sm', isMe ? 'bg-accent text-accent-on' : 'bg-surface-2 text-ink')}>
                    {!isMe && <p className="mb-0.5 text-meta font-medium text-ink-2">{m.sender?.name}</p>}
                    <p className="whitespace-pre-wrap break-words text-body">{m.content}</p>
                    <p className={cn('mt-0.5 text-right text-meta tabular-nums', isMe ? 'text-accent-on/70' : 'text-ink-3')}>
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
        {thread.status === 'resolved' ? (
          <p className="text-center text-body text-ink-2">Conversación resuelta. Puedes eliminarla con el botón de arriba.</p>
        ) : (
          <div className="flex gap-2">
            <Input
              type="text"
              aria-label="Mensaje"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Escribe un mensaje"
              autoComplete="off"
              enterKeyHint="send"
              className="flex-1"
            />
            <Button onClick={send} disabled={!text.trim() || sending} aria-label="Enviar mensaje">
              <SendHorizontal className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Enviar</span>
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
