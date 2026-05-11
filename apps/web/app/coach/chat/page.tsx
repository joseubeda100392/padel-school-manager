export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StudentChatClient } from '@/app/student/chat/student-chat-client'

export default async function CoachChatPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: thread } = await supabase
    .from('chat_threads')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!thread) {
    const { data: newThread } = await supabase
      .from('chat_threads')
      .insert({ user_id: user.id, status: 'active' })
      .select('id, status')
      .single()
    thread = newThread
  }

  if (!thread) redirect('/coach')

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*, sender:users(name, role)')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })

  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-sm md:h-[calc(100vh-8rem)]">
      <StudentChatClient
        threadId={thread.id}
        threadStatus={thread.status}
        initialMessages={messages ?? []}
        currentUserId={user.id}
      />
    </div>
  )
}
