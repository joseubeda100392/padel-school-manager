export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StudentChatClient } from './student-chat-client'
import { getClubFeatures } from '@/lib/get-club-features'
import { Avatar } from '@/components/ui/list'

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

  // userProfile y enrollments dependen solo de user.id, ninguno del otro: en paralelo.
  const [{ data: userProfile }, { data: enrollments }] = await Promise.all([
    admin.from('users').select('club_id').eq('id', user.id).single(),
    // Get student's coaches from active group enrollments (admin client bypasses RLS on users join)
    admin
      .from('group_enrollments')
      .select('schedule:schedules(coach_id, coach:users!schedules_coach_id_fkey(id, name))')
      .eq('student_id', user.id)
      .eq('status', 'active'),
  ])
  const clubId = (userProfile?.club_id as string | null) ?? null

  const features = await getClubFeatures(clubId ?? undefined)
  if (!features.enable_chat) redirect('/student')

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

  const linkClass = (active: boolean) =>
    `flex min-h-11 items-center justify-center gap-2.5 rounded-control px-1.5 py-1.5 text-label transition-colors sm:justify-start sm:px-2.5 ${
      active ? 'bg-accent-soft text-accent-ink' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'
    }`

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-card border border-line bg-surface shadow-card">
      {/* Conversaciones: solo iconos en móvil, completo desde sm */}
      <aside className="flex w-14 shrink-0 flex-col border-r border-line sm:w-48">
        <div className="hidden border-b border-line px-3 py-3 sm:block">
          <h2 className="text-label text-ink-2">Conversaciones</h2>
        </div>
        <nav aria-label="Conversaciones" className="flex-1 space-y-1 overflow-y-auto p-1.5 sm:p-2">
          <Link
            href="/student/chat?with=admin"
            title="Administración"
            aria-label="Administración"
            aria-current={withParam === 'admin' ? 'page' : undefined}
            className={linkClass(withParam === 'admin')}
          >
            <Avatar name="Administración" className="h-8 w-8 text-meta" />
            <span className="hidden truncate sm:block">Administración</span>
          </Link>
          {coaches.map(c => (
            <Link
              key={c.id}
              href={`/student/chat?with=${c.id}`}
              title={c.name}
              aria-label={c.name}
              aria-current={withParam === c.id ? 'page' : undefined}
              className={linkClass(withParam === c.id)}
            >
              <Avatar name={c.name} className="h-8 w-8 text-meta" />
              <span className="hidden truncate sm:block">{c.name}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Ventana de chat */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
