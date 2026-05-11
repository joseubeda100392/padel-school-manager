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

interface Props {
  threadId: string
  threadStatus: string
  initialMessages: Message[]
  currentUserId: string
  recipientLabel?: string
}

export function StudentChatClient({ threadId, threadStatus, initialMessages, currentUserId, recipientLabel = 'Soporte' }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-100 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
          <span className="text-sm font-bold text-green-700">S</span>
        </div>
        <div>
          <p className="font-semibold text-gray-900">{recipientLabel}</p>
          <p className="text-xs text-gray-400">
            {threadStatus === 'active' ? 'Te responderemos pronto' : 'Conversación resuelta'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-gray-400">
            ¡Hola! Escríbenos lo que necesites y te responderemos pronto.
          </p>
        )}
        {messages.map(m => {
          const isMe = m.sender_id === currentUserId
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-2.5 sm:max-w-sm ${isMe ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                {!isMe && (
                  <p className="mb-0.5 text-xs font-medium opacity-70">{m.sender?.name ?? 'Administración'}</p>
                )}
                <p className="text-sm">{m.content}</p>
                <p className="mt-0.5 text-right text-xs opacity-60">
                  {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 p-4">
        {threadStatus === 'resolved' ? (
          <p className="text-center text-sm text-gray-400">Esta conversación ha sido resuelta por el administrador.</p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
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
    </div>
  )
}
