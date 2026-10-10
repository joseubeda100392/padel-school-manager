export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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

  // Coach's own thread with admin + threads de alumnos (independientes, en paralelo)
  let [{ data: adminThread }, { data: studentThreads }] = await Promise.all([
    supabase
      .from('chat_threads')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('thread_type', 'admin')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('chat_threads')
      .select('id, status, user:users!chat_threads_user_id_fkey(id, name)')
      .eq('recipient_id', user.id)
      .eq('thread_type', 'coach')
      .order('created_at', { ascending: false }),
  ])

  if (!adminThread) {
    const { data: t } = await supabase
      .from('chat_threads')
      .insert({ user_id: user.id, status: 'active', thread_type: 'admin', club_id: (coachProfile as any)?.club_id ?? null })
      .select('id, status')
      .single()
    adminThread = t
  }

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
    <div className="flex h-[calc(100dvh-var(--tabbar-h)-var(--safe-bottom)-8rem)] overflow-hidden rounded-card border border-line bg-surface shadow-card md:h-[calc(100dvh-6rem)]">
      <aside className="flex w-32 shrink-0 flex-col border-r border-line sm:w-48">
        <div className="border-b border-line px-3 py-3">
          <h1 className="text-label text-ink-2">Chat</h1>
        </div>
        <nav aria-label="Conversaciones" className="flex-1 space-y-1 overflow-y-auto p-2">
          {adminThread && (
            <Link
              href={`/coach/chat?thread=${adminThread.id}`}
              aria-current={activeId === adminThread.id ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-2.5 rounded-control px-2 py-2 text-label transition-colors ${
                activeId === adminThread.id
                  ? 'bg-accent-soft text-accent-ink'
                  : 'text-ink-2 hover:bg-ink/5'
              }`}
            >
              <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chrome text-meta font-medium text-chrome-ink">A</span>
              <span className="truncate">Administración</span>
            </Link>
          )}

          {(studentThreads ?? []).length > 0 && (
            <>
              <p className="mt-3 px-2 text-meta text-ink-3">Alumnos</p>
              {(studentThreads ?? []).map((t: any) => {
                const name = t.user?.name ?? 'Alumno'
                const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                return (
                  <Link
                    key={t.id}
                    href={`/coach/chat?thread=${t.id}`}
                    aria-current={activeId === t.id ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-2.5 rounded-control px-2 py-2 text-label transition-colors ${
                      activeId === t.id
                        ? 'bg-accent-soft text-accent-ink'
                        : 'text-ink-2 hover:bg-ink/5'
                    }`}
                  >
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chrome text-meta font-medium text-chrome-ink">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{name}</p>
                      {t.status === 'resolved' && (
                        <p className="text-meta text-ink-3">Resuelto</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </>
          )}
        </nav>
      </aside>

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
          <div className="flex flex-1 items-center justify-center p-4 text-center text-body text-ink-3">
            Selecciona una conversación
          </div>
        )}
      </div>
    </div>
  )
}
