'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function ChatWindow({ thread, initialMessages, currentUserId }: Props) {
  const router = useRouter()
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
      .channel(`thread-${thread.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${thread.id}` },
        async (payload) => {
          const { data } = await supabase
            .from('chat_messages')
            .select('*, sender:users(name, role)')
            .eq('id', payload.new.id)
            .single()
          if (data) setMessages((prev) => [...prev, data as Message])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [thread.id])

  async function send() {
    if (!text.trim()) return
    setSending(true)
    await supabase.from('chat_messages').insert({
      thread_id: thread.id,
      sender_id: currentUserId,
      content: text.trim(),
    })
    setText('')
    setSending(false)
  }

  async function resolve() {
    await supabase.from('chat_threads').update({ status: 'resolved' }).eq('id', thread.id)
    router.refresh()
    router.push('/dashboard/chat')
  }

  async function deleteThread() {
    if (!confirm('¿Eliminar esta conversación? Se borrarán todos los mensajes.')) return
    setDeleting(true)
    await supabase.from('chat_threads').delete().eq('id', thread.id)
    router.refresh()
    router.push('/dashboard/chat')
  }

  // Group messages by date
  const grouped: { date: string; msgs: Message[] }[] = []
  for (const m of messages) {
    const label = formatDate(m.created_at)
    const last = grouped[grouped.length - 1]
    if (last && last.date === label) last.msgs.push(m)
    else grouped.push({ date: label, msgs: [m] })
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <div>
          <p className="font-semibold text-gray-900">{thread.user?.name ?? 'Desconocido'}</p>
          <p className="text-xs text-gray-400">{thread.user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {thread.status === 'active' && (
            <button
              onClick={resolve}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
            >
              Marcar resuelto
            </button>
          )}
          <button
            onClick={deleteThread}
            disabled={deleting}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400">Sin mensajes aún.</p>
        )}
        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-xs text-gray-400">{date}</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>
            {msgs.map((m) => {
              const isMe = m.sender_id === currentUserId
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                  <div className={`max-w-sm rounded-2xl px-4 py-2.5 ${isMe ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                    {!isMe && (
                      <p className="mb-0.5 text-xs font-medium opacity-70">{m.sender?.name}</p>
                    )}
                    <p className="text-sm">{m.content}</p>
                    <p className="mt-0.5 text-right text-xs opacity-60">
                      {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 p-4">
        {thread.status === 'resolved' ? (
          <p className="text-center text-sm text-gray-400">Conversación resuelta. Puedes eliminarla con el botón de arriba.</p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Escribe un mensaje..."
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              Enviar
            </button>
          </div>
        )}
      </div>
    </>
  )
}
