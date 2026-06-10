export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { StudentChatClient } from '@/app/student/chat/student-chat-client'
import { getClubFeatures } from '@/lib/get-club-features'

export default async function CoachChatPage({
  searchParams,
}: {
  searchParams: { thread?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: coachProfile } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const features = await getClubFeatures((coachProfile as any)?.club_id)
  if (!features.enable_chat) redirect('/coach')

  // Coach's own thread with admin
  let { data: adminThread } = await supabase
    .from('chat_threads')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('thread_type', 'admin')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!adminThread) {
    const { data: t } = await supabase
      .from('chat_threads')
      .insert({ user_id: user.id, status: 'active', thread_type: 'admin' })
      .select('id, status')
      .single()
    adminThread = t
  }

  // Threads from students directed to this coach
  const { data: studentThreads } = await supabase
    .from('chat_threads')
    .select('id, status, user:users!chat_threads_user_id_fkey(id, name)')
    .eq('recipient_id', user.id)
    .eq('thread_type', 'coach')
    .order('created_at', { ascending: false })

  // Active thread: from searchParams or admin thread by default
  const activeId = searchParams.thread ?? adminThread?.id ?? null
  const isAdminThread = activeId === adminThread?.id
  const activeStudentThread = (studentThreads ?? []).find((t: any) => t.id === activeId)

  let messages: any[] = []
  if (activeId) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:users(name, role)')
      .eq('thread_id', activeId)
      .order('created_at', { ascending: true })
    messages = data ?? []
  }

  const activeThread = isAdminThread ? adminThread : activeStudentThread
  const recipientLabel = isAdminThread
    ? 'Administración'
    : (activeStudentThread as any)?.user?.name ?? 'Alumno'

  return (
    <div className="flex h-[calc(100vh-10rem)] overflow-hidden rounded-xl bg-white shadow-sm md:h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <aside className="flex w-48 shrink-0 flex-col border-r border-gray-100 sm:w-56">
        <div className="border-b border-gray-100 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Chat</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Admin thread */}
          {adminThread && (
            <a
              href={`/coach/chat?thread=${adminThread.id}`}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                activeId === adminThread.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">A</span>
              <span className="truncate">Administración</span>
            </a>
          )}

          {/* Student threads */}
          {(studentThreads ?? []).length > 0 && (
            <>
              <p className="mt-3 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Alumnos</p>
              {(studentThreads ?? []).map((t: any) => {
                const name = t.user?.name ?? 'Alumno'
                const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                return (
                  <a
                    key={t.id}
                    href={`/coach/chat?thread=${t.id}`}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      activeId === t.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{name}</p>
                      {t.status === 'resolved' && (
                        <p className="text-xs text-gray-400">Resuelto</p>
                      )}
                    </div>
                  </a>
                )
              })}
            </>
          )}
        </nav>
      </aside>

      {/* Chat window */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeThread ? (
          <StudentChatClient
            threadId={activeThread.id}
            threadStatus={activeThread.status}
            initialMessages={messages}
            currentUserId={user.id}
            recipientLabel={recipientLabel}
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
