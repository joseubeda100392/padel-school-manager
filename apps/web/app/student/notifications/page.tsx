import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { MarkNotificationsRead } from './mark-read'
import { NotificationList } from './notification-list'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { PageHeader } from '@/components/ui/page-header'

export default async function StudentNotificationsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: notifications } = await admin
    .from('notifications')
    .select('id, type, title, body, data, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <RealtimeRefresh
        channelName={`student-notifications-${user.id}`}
        subs={[{ table: 'notifications', filter: `user_id=eq.${user.id}` }]}
      />
      <PageHeader title="Notificaciones" description="Tus últimos avisos." />

      <MarkNotificationsRead />

      <NotificationList initial={notifications ?? []} />
    </div>
  )
}
