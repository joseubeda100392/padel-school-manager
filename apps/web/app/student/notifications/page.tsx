import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MarkNotificationsRead } from './mark-read'

const TYPE_ICON: Record<string, string> = {
  spot_available: '🎾',
  admin_message: '📢',
  payment_reminder: '💳',
  payment_succeeded: '✅',
  payment_failed: '❌',
  booking_confirmed: '✅',
  booking_cancelled: '❌',
  class_reminder: '📅',
  level_updated: '🏆',
  chat_message: '💬',
}

export default async function StudentNotificationsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-sm text-gray-500">Tus últimos avisos</p>
        </div>
      </div>

      {/* Marca todas como leídas en cuanto el alumno abre la página */}
      <MarkNotificationsRead />

      {(!notifications || notifications.length === 0) ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-2xl mb-2">🔔</p>
          <p className="text-gray-400">No tienes notificaciones todavía.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const icon = TYPE_ICON[n.type] ?? '🔔'
            const url = (n.data as any)?.url
            const dateLabel = new Date(n.created_at).toLocaleDateString('es-ES', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })

            const card = (
              <div className={`flex gap-4 rounded-xl p-4 shadow-sm transition-colors ${n.is_read ? 'bg-white' : 'bg-green-50 border border-green-100'}`}>
                <div className="mt-0.5 text-2xl">{icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${n.is_read ? 'text-gray-800' : 'text-gray-900'}`}>
                      {n.title}
                    </p>
                    {!n.is_read && (
                      <span className="shrink-0 h-2 w-2 rounded-full bg-green-500 mt-1.5" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>
                  <p className="mt-1 text-xs text-gray-400">{dateLabel}</p>
                </div>
              </div>
            )

            return url ? (
              <a key={n.id} href={url} className="block hover:opacity-90">
                {card}
              </a>
            ) : (
              <div key={n.id}>{card}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}
