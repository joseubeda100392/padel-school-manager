'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

type Notification = {
  id: string
  type: string
  title: string
  body: string
  data: unknown
  is_read: boolean
  created_at: string
}

export function NotificationList({ initial, targetUserId }: { initial: Notification[]; targetUserId?: string }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)

  async function deleteOne(id: string) {
    setDeletingId(id)
    setItems(prev => prev.filter(n => n.id !== id))
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeletingId(null)
    router.refresh()
  }

  async function deleteAll() {
    setClearingAll(true)
    setItems([])
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, ...(targetUserId ? { userId: targetUserId } : {}) }),
    })
    setClearingAll(false)
    router.refresh()
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-white p-10 text-center shadow-sm">
        <p className="text-2xl mb-2">🔔</p>
        <p className="text-gray-400">No tienes notificaciones.</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          onClick={deleteAll}
          disabled={clearingAll}
          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
        >
          {clearingAll ? 'Borrando...' : 'Borrar todo'}
        </button>
      </div>

      <div className="space-y-2">
        {items.map(n => {
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
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); deleteOne(n.id) }}
                disabled={deletingId === n.id}
                className="ml-1 shrink-0 self-start rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-400 disabled:opacity-40"
                aria-label="Borrar notificación"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
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
    </>
  )
}
