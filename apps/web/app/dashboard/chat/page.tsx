export const dynamic = 'force-dynamic'

import { getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { redirect } from 'next/navigation'
import { ChatInbox, type InboxThread } from './chat-inbox'
import { DevError } from '@/components/dev-error'

export default async function ChatPage({ searchParams }: { searchParams: { thread?: string } }) {
  const admin = getAdminClient()

  // clubId y currentUser no dependen entre sí — en paralelo.
  const [clubId, currentUser] = await Promise.all([
    getClubId(),
    getAuthUser(),
  ])

  let threadsQuery = admin
    .from('chat_threads')
    .select('id, status, created_at, user_id, club_id, user:users!chat_threads_user_id_fkey(name, email), lastMessage:chat_messages(content, created_at)')
    .eq('thread_type', 'admin')
    .order('created_at', { ascending: false })
    // Solo el último mensaje de cada conversación (antes venían todos y se
    // enseñaba el primero como vista previa).
    .order('created_at', { referencedTable: 'chat_messages', ascending: false })
    .limit(1, { referencedTable: 'chat_messages' })
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
  if (activeThreadId) {
    const { data } = await admin
      .from('chat_messages')
      .select('*, sender:users(name, role)')
      .eq('thread_id', activeThreadId)
      .order('created_at', { ascending: true })
    messages = data ?? []
  }

  const inboxThreads: InboxThread[] = (threads ?? []).map((t: any) => ({
    id: t.id,
    status: t.status,
    user: t.user ?? null,
    lastMessage: t.lastMessage?.[0]?.content ?? null,
  }))

  return (
    <div className="flex flex-col gap-2">
      <DevError errors={[errThreads?.message]} />
      <ChatInbox
        threads={inboxThreads}
        initialThreadId={activeThreadId}
        initialMessages={messages}
        currentUserId={currentUser?.id ?? ''}
        initialShowChat={mobileShowChat}
      />
    </div>
  )
}
