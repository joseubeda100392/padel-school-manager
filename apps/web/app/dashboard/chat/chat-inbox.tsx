'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'
import { ChatWindow, type ChatMessage, type ChatThread } from './chat-window'

export interface InboxThread extends ChatThread {
  lastMessage: string | null
}

// Lista de conversaciones y conversación abierta. Cambiar de conversación no
// vuelve a cargar la página: se marca al momento y solo se piden sus mensajes
// (antes cada clic recargaba la pantalla entera y, mientras tanto, seguían
// en pantalla los mensajes de la conversación anterior).
export function ChatInbox({ threads, initialThreadId, initialMessages, currentUserId, initialShowChat }: {
  threads: InboxThread[]
  initialThreadId: string | null
  initialMessages: ChatMessage[]
  currentUserId: string
  initialShowChat: boolean
}) {
  const [activeId, setActiveId] = useState(initialThreadId)
  const [showChat, setShowChat] = useState(initialShowChat)
  const active = threads.find(t => t.id === activeId) ?? null

  // Botón "atrás" del navegador o del móvil: vuelve a la conversación de la URL.
  useEffect(() => {
    function onPop() {
      const id = new URLSearchParams(window.location.search).get('thread')
      setShowChat(!!id)
      if (id) setActiveId(id)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function open(id: string) {
    setActiveId(id)
    setShowChat(true)
    window.history.pushState(null, '', `/dashboard/chat?thread=${id}`)
  }

  function back() {
    setShowChat(false)
    window.history.pushState(null, '', '/dashboard/chat')
  }

  return (
    <div className="flex h-[calc(100dvh-var(--tabbar-h)-var(--safe-bottom)-8rem)] gap-0 overflow-hidden rounded-card border border-line bg-surface shadow-card md:h-[calc(100dvh-6rem)]">
      <aside className={cn('flex flex-shrink-0 flex-col border-r border-line', showChat ? 'hidden md:flex md:w-72' : 'w-full md:w-72')}>
        <div className="border-b border-line p-4">
          <h1 className="text-heading text-ink">Chat de soporte</h1>
          <p className="text-meta tabular-nums text-ink-3">{threads.length} conversaciones</p>
        </div>
        <nav aria-label="Conversaciones" className="flex-1 overflow-y-auto">
          {threads.length === 0 && (
            <EmptyState icon={<MessageSquare />} title="Sin conversaciones" description="Cuando un alumno escriba, la conversación aparecerá aquí." />
          )}
          <ul className="divide-y divide-line">
            {threads.map(t => (
              <li key={t.id}>
                <a
                  href={`/dashboard/chat?thread=${t.id}`}
                  onClick={e => { e.preventDefault(); open(t.id) }}
                  aria-current={activeId === t.id ? 'true' : undefined}
                  className={cn(
                    'block min-h-14 border-l-2 p-4 transition-colors hover:bg-ink/[0.03]',
                    activeId === t.id ? 'border-l-accent-ink bg-accent-soft' : 'border-l-transparent',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label text-ink">{t.user?.name ?? 'Desconocido'}</p>
                      <p className="truncate text-meta text-ink-3">{t.lastMessage ?? 'Sin mensajes'}</p>
                    </div>
                    <Badge tone={t.status === 'active' ? 'success' : 'neutral'}>
                      {t.status === 'active' ? 'Activo' : 'Resuelto'}
                    </Badge>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className={cn('min-w-0 flex-1 flex-col', showChat ? 'flex' : 'hidden md:flex')}>
        {showChat && (
          <button
            type="button"
            onClick={back}
            className="flex min-h-11 items-center gap-1 border-b border-line px-3 text-left text-label text-ink-2 hover:bg-ink/[0.03] md:hidden"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Conversaciones
          </button>
        )}
        {active ? (
          <ChatWindow
            key={active.id}
            thread={active}
            initialMessages={active.id === initialThreadId ? initialMessages : undefined}
            currentUserId={currentUserId}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-body text-ink-2">
            Selecciona una conversación
          </div>
        )}
      </div>
    </div>
  )
}
