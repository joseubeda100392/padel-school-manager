import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { ChatWindow } from './chat-window'

export default async function ChatPage({ searchParams }: { searchParams: { thread?: string } }) {
  const supabase = createClient()
  const clubId = await getClubId()

  const threadQuery = supabase
    .from('chat_threads')
    .select('*, user:users(name, email), lastMessage:chat_messages(content, created_at)')
    .eq('thread_type', 'admin')
    .order('created_at', { ascending: false })

  const { data: threads } = await (clubId ? threadQuery.eq('club_id', clubId) : threadQuery)

  const activeThreadId = searchParams.thread ?? threads?.[0]?.id ?? null

  let messages: any[] = []
  let activeThread: any = null
  if (activeThreadId) {
    activeThread = threads?.find((t: any) => t.id === activeThreadId)
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:users(name, role)')
      .eq('thread_id', activeThreadId)
      .order('created_at', { ascending: true })
    messages = data ?? []
  }

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  return (
    <div className="flex h-[calc(100vh-9rem)] gap-0 overflow-hidden rounded-xl bg-white shadow-sm">
      {/* Thread list */}
      <aside className="flex w-72 flex-shrink-0 flex-col border-r border-gray-100">
        <div className="border-b border-gray-100 p-4">
          <h1 className="font-semibold text-gray-900">Chat soporte</h1>
          <p className="text-xs text-gray-400">{threads?.length ?? 0} conversaciones</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads?.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-400">No hay conversaciones aún.</p>
          )}
          {threads?.map((t: any) => (
            <a
              key={t.id}
              href={`/dashboard/chat?thread=${t.id}`}
              className={`block border-b border-gray-50 p-4 hover:bg-gray-50 ${activeThreadId === t.id ? 'bg-green-50 border-l-2 border-l-green-600' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{t.user?.name ?? 'Desconocido'}</p>
                  <p className="truncate text-xs text-gray-400">{t.lastMessage?.[0]?.content ?? 'Sin mensajes'}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {t.status === 'active' ? 'Activo' : 'Resuelto'}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </aside>

      {/* Chat window */}
      <div className="flex flex-1 flex-col">
        {activeThread ? (
          <ChatWindow
            thread={activeThread}
            initialMessages={messages}
            currentUserId={currentUser?.id ?? ''}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-400">
            Selecciona una conversación
          </div>
        )}
      </div>
    </div>
  )
}
