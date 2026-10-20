'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, CalendarDays, CalendarPlus, CircleAlert, CircleCheck, CircleX, CreditCard, Megaphone, MessageCircle, Trash2, Trophy, type LucideIcon } from 'lucide-react'
import { formatClock, formatLongDate } from '@/lib/format-date'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'

const TYPE_ICON: Record<string, LucideIcon> = {
  spot_available: CalendarPlus,
  admin_message: Megaphone,
  payment_reminder: CreditCard,
  payment_succeeded: CircleCheck,
  payment_failed: CircleAlert,
  booking_confirmed: CircleCheck,
  booking_cancelled: CircleX,
  class_reminder: CalendarDays,
  level_updated: Trophy,
  chat_message: MessageCircle,
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
      <Card>
        <EmptyState icon={<Bell />} title="No tienes notificaciones" description="Aquí verás los avisos del club y de tus clases." />
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="danger-ghost" size="sm" onClick={deleteAll} loading={clearingAll}>
          {clearingAll ? 'Borrando...' : 'Borrar todo'}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {items.map(n => {
            const Icon = TYPE_ICON[n.type] ?? Bell
            const url = (n.data as any)?.url
            const dateLabel = `${formatLongDate(n.created_at, { weekday: false })}, ${formatClock(n.created_at)}`

            const content = (
              <>
                <span aria-hidden className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${n.is_read ? 'bg-ink/[0.05] text-ink-3' : 'bg-accent-soft text-accent-ink'}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-body text-ink ${n.is_read ? 'font-medium' : 'font-semibold'}`}>
                    {!n.is_read && <span className="sr-only">Sin leer. </span>}
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-body text-ink-2">{n.body}</p>
                  <p className="mt-1 text-meta tabular-nums text-ink-3">{dateLabel}</p>
                </div>
                {!n.is_read && <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-ink" />}
              </>
            )
            const contentClass = 'flex min-w-0 flex-1 items-start gap-3 py-3 pl-4'

            return (
              <li key={n.id} className={`flex items-start ${n.is_read ? '' : 'bg-accent-soft/40'}`}>
                {url ? (
                  <Link href={url} className={`${contentClass} hover:bg-ink/[0.03]`}>{content}</Link>
                ) : (
                  <div className={contentClass}>{content}</div>
                )}
                <button
                  type="button"
                  onClick={() => deleteOne(n.id)}
                  disabled={deletingId === n.id}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-danger-soft hover:text-danger-ink disabled:opacity-40"
                  aria-label={`Borrar notificación: ${n.title}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
