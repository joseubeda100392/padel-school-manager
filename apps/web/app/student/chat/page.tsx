export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { StudentChatClient } from './student-chat-client'

async function findOrCreateThread(supabase: any, userId: string, type: string, clubId: string | null, recipientId?: string) {
  const query = supabase
    .from('chat_threads')
    .select('id, status')
    .eq('user_id', userId)
    .eq('thread_type', type)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data: thread } = await (
    recipientId ? query.eq('recipient_id', recipientId) : query.is('recipient_id', null)
  ).maybeSingle()

  if (thread) return thread

  const insert: any = { user_id: userId, status: 'active', thread_type: type }
  if (clubId) insert.club_id = clubId
  if (recipientId) insert.recipient_id = recipientId

  const { data: newThread } = await supabase
    .from('chat_threads')
    .insert(insert)
    .select('id, status')
    .single()

  return newThread
}

export default async function StudentChatPage({
  searchParams,
}: {
  searchParams: { with?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  const { data: userProfile } = await admin
    .from('users')
    .select('club_id')
    .eq('id', user.id)
    .single()
  const clubId = (userProfile?.club_id as string | null) ?? null

  // Get student's coaches from active group enrollments (admin client bypasses RLS on users join)
  const { data: enrollments } = await admin
    .from('group_enrollments')
    .select('schedule:schedules(coach_id, coach:users!schedules_coach_id_fkey(id, name))')
    .eq('student_id', user.id)
    .eq('status', 'active')

  // Deduplicate coaches
  const coachMap = new Map<string, { id: string; name: string }>()
  for (const e of enrollments ?? []) {
    const coach = (e.schedule as any)?.coach
    if (coach?.id && coach?.name) coachMap.set(coach.id, coach)
  }
  const coaches = Array.from(coachMap.values())

  // Determine active conversation
  const withParam = searchParams.with ?? 'admin'
  const isCoach = withParam !== 'admin' && coachMap.has(withParam)
  const activeCoachId = isCoach ? withParam : undefined

  const thread = await findOrCreateThread(
    supabase,
    user.id,
    isCoach ? 'coach' : 'admin',
    clubId,
    activeCoachId,
  )

  if (!thread) redirect('/student')

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*, sender:users(name, role)')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })

  const activeLabel = isCoach
    ? coachMap.get(activeCoachId!)?.name ?? 'Monitor'
    : 'Administración'

  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-3xl overflow-hidden rounded-xl bg-white shadow-sm md:h-[calc(100vh-8rem)]">
      {/* Sidebar siempre visible */}
      <aside className="flex w-44 shrink-0 flex-col border-r border-gray-100 sm:w-52">
        <div className="border-b border-gray-100 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Conversaciones</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          <a
            href="/student/chat?with=admin"
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              withParam === 'admin' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">A</span>
            <span className="truncate">Administración</span>
          </a>
          {coaches.map(c => (
            <a
              key={c.id}
              href={`/student/chat?with=${c.id}`}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                withParam === c.id ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {c.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <span className="truncate">{c.name}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Chat window */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <StudentChatClient
          threadId={thread.id}
          threadStatus={thread.status}
          initialMessages={messages ?? []}
          currentUserId={user.id}
          recipientLabel={activeLabel}
        />
      </div>
    </div>
  )
}
