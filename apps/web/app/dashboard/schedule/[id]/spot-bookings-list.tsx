'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SpotBooking = {
  id: string
  source: string
  class_date: string
  student: { name: string; email: string } | null
}

const sourceLabel: Record<string, string> = { bag: 'Crédito bolsa', pay_per_class: 'Pago único', admin: 'Admin' }
const sourceBadge: Record<string, string> = {
  bag: 'bg-orange-100 text-orange-700',
  pay_per_class: 'bg-blue-100 text-blue-700',
  admin: 'bg-gray-100 text-gray-600',
}

export function SpotBookingsList({ bookings }: { bookings: SpotBooking[] }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(bookingId: string) {
    if (!confirm('¿Cancelar esta reserva puntual? Se devolverá el crédito al alumno.')) return
    setDeleting(bookingId)
    await fetch('/api/bookings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, refundBag: true }),
    })
    setDeleting(null)
    router.refresh()
  }

  if (bookings.length === 0) return null

  return (
    <div className="divide-y divide-gray-50">
      {bookings.map((b) => {
        const dateLabel = new Date(b.class_date + 'T12:00:00').toLocaleDateString('es-ES', {
          weekday: 'long', day: 'numeric', month: 'long',
        })
        const initials = (b.student?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
        return (
          <div key={b.id} className="flex items-center gap-4 px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{b.student?.name}</p>
              <p className="text-sm text-gray-400">{b.student?.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700 capitalize">{dateLabel}</p>
                <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sourceBadge[b.source] ?? 'bg-gray-100 text-gray-600'}`}>
                  {sourceLabel[b.source] ?? b.source}
                </span>
              </div>
              <button
                onClick={() => handleDelete(b.id)}
                disabled={deleting === b.id}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                title="Cancelar reserva"
              >
                {deleting === b.id ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
