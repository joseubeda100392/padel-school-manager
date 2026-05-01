'use client'

import { useState, useEffect, useRef } from 'react'
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

export function ChatWindow({ thread, initialMessages, currentUserId }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

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
    window.location.href = '/dashboard/chat'
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <div>
          <p className="font-semibold text-gray-900">{thread.user?.name ?? 'Desconocido'}</p>
          <p className="text-xs text-gray-400">{thread.user?.email}</p>
        </div>
        {thread.status === 'active' && (
          <button
            onClick={resolve}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            Marcar resuelto
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400">Sin mensajes aún.</p>
        )}
        {messages.map((m) => {
          const isMe = m.sender_id === currentUserId
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-sm rounded-2xl px-4 py-2.5 ${isMe ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                {!isMe && (
                  <p className="mb-0.5 text-xs font-medium opacity-70">{m.sender?.name}</p>
                )}
                <p className="text-sm">{m.content}</p>
                <p className={`mt-0.5 text-right text-xs opacity-60`}>
                  {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Escribe un mensaje..."
            disabled={thread.status === 'resolved'}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending || thread.status === 'resolved'}
            className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            Enviar
          </button>
        </div>
        {thread.status === 'resolved' && (
          <p className="mt-2 text-center text-xs text-gray-400">Esta conversación está resuelta.</p>
        )}
      </div>
    </>
  )
}
