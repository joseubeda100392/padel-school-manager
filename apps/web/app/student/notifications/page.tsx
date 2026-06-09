import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { MarkNotificationsRead } from './mark-read'
import { NotificationList } from './notification-list'
import { RealtimeRefresh } from '@/components/realtime-refresh'

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
    <div className="max-w-2xl">
      <RealtimeRefresh
        channelName={`student-notifications-${user.id}`}
        subs={[{ table: 'notifications', filter: `user_id=eq.${user.id}` }]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
        <p className="text-sm text-gray-500">Tus últimos avisos</p>
      </div>

      <MarkNotificationsRead />

      <NotificationList initial={notifications ?? []} />
    </div>
  )
}
