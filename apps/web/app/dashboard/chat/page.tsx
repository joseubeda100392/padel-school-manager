export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, MessageSquare } from 'lucide-react'
import { ChatWindow } from './chat-window'
import { DevError } from '@/components/dev-error'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'

export default async function ChatPage({ searchParams }: { searchParams: { thread?: string } }) {
  const supabase = createClient()
  const admin = getAdminClient()

  // clubId y currentUser no dependen entre sí — en paralelo.
  const [clubId, { data: { user: currentUser } }] = await Promise.all([
    getClubId(),
    supabase.auth.getUser(),
  ])

  let threadsQuery = admin
    .from('chat_threads')
    .select('id, status, created_at, user_id, club_id, user:users!chat_threads_user_id_fkey(name, email), lastMessage:chat_messages(content, created_at)')
    .eq('thread_type', 'admin')
    .order('created_at', { ascending: false })
  if (clubId) threadsQuery = threadsQuery.eq('club_id', clubId)

  // features y threads dependen solo de clubId, ninguno del otro — en paralelo.
  const [features, { data: threads, error: errThreads }] = await Promise.all([
    getClubFeatures(clubId ?? undefined),
    threadsQuery,
  ])
  if (!features.enable_chat) redirect('/dashboard')

  const activeThreadId = searchParams.thread ?? threads?.[0]?.id ?? null
  const mobileShowChat = !!searchParams.thread

  let messages: any[] = []
  let activeThread: any = null
  if (activeThreadId) {
    activeThread = threads?.find((t: any) => t.id === activeThreadId)
    const { data } = await admin
      .from('chat_messages')
      .select('*, sender:users(name, role)')
      .eq('thread_id', activeThreadId)
      .order('created_at', { ascending: true })
    messages = data ?? []
  }

  return (
    <div className="flex flex-col gap-2">
      <DevError errors={[errThreads?.message]} />
      <div className="flex h-[calc(100dvh-var(--tabbar-h)-var(--safe-bottom)-8rem)] gap-0 overflow-hidden rounded-card border border-line bg-surface shadow-card md:h-[calc(100dvh-6rem)]">
        {/* Thread list — full width on mobile when no thread selected, sidebar on md+ */}
        <aside className={cn('flex flex-shrink-0 flex-col border-r border-line', mobileShowChat ? 'hidden md:flex md:w-72' : 'w-full md:w-72')}>
          <div className="border-b border-line p-4">
            <h1 className="text-heading text-ink">Chat de soporte</h1>
            <p className="text-meta tabular-nums text-ink-3">{threads?.length ?? 0} conversaciones</p>
          </div>
          <nav aria-label="Conversaciones" className="flex-1 overflow-y-auto">
            {threads?.length === 0 && (
              <EmptyState icon={<MessageSquare />} title="Sin conversaciones" description="Cuando un alumno escriba, la conversación aparecerá aquí." />
            )}
            <ul className="divide-y divide-line">
              {threads?.map((t: any) => (
                <li key={t.id}>
                  <Link
                    href={`/dashboard/chat?thread=${t.id}`}
                    aria-current={activeThreadId === t.id ? 'true' : undefined}
                    className={cn(
                      'block min-h-14 border-l-2 p-4 transition-colors hover:bg-ink/[0.03]',
                      activeThreadId === t.id ? 'border-l-accent-ink bg-accent-soft' : 'border-l-transparent',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-label text-ink">{t.user?.name ?? 'Desconocido'}</p>
                        <p className="truncate text-meta text-ink-3">{t.lastMessage?.[0]?.content ?? 'Sin mensajes'}</p>
                      </div>
                      <Badge tone={t.status === 'active' ? 'success' : 'neutral'}>
                        {t.status === 'active' ? 'Activo' : 'Resuelto'}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Chat panel — hidden on mobile until a thread is explicitly selected */}
        <div className={cn('min-w-0 flex-1 flex-col', mobileShowChat ? 'flex' : 'hidden md:flex')}>
          {mobileShowChat && (
            <Link
              href="/dashboard/chat"
              className="flex min-h-11 items-center gap-1 border-b border-line px-3 text-label text-ink-2 hover:bg-ink/[0.03] md:hidden"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Conversaciones
            </Link>
          )}
          {activeThread ? (
            <ChatWindow
              thread={activeThread}
              initialMessages={messages}
              currentUserId={currentUser?.id ?? ''}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-body text-ink-2">
              Selecciona una conversación
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
