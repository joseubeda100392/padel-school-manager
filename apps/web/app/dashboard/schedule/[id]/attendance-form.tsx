'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Booking {
  id: string
  status: string
  student: {
    name: string
    email: string
    avatar_url?: string
    currentLevel?: { name: string; color: string } | null
  }
}

export default function AttendanceForm({ bookings: initial }: { bookings: Booking[] }) {
  const [bookings, setBookings] = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)

  async function markStatus(bookingId: string, status: 'confirmed' | 'no_show') {
    setSaving(bookingId)
    const supabase = createClient()
    await supabase.from('bookings').update({ status }).eq('id', bookingId)
    setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status } : b))
    setSaving(null)
  }

  if (bookings.length === 0) {
    return <p className="px-6 py-10 text-center text-sm text-gray-400">Ningún alumno apuntado aún.</p>
  }

  const attended = bookings.filter((b) => b.status === 'confirmed').length
  const absent = bookings.filter((b) => b.status === 'no_show').length

  return (
    <>
      {/* Resumen */}
      <div className="border-b border-gray-100 px-6 py-3">
        <div className="flex gap-4 text-sm">
          <span className="text-green-700">✓ Asistieron: <strong>{attended}</strong></span>
          <span className="text-red-600">✗ No asistieron: <strong>{absent}</strong></span>
          <span className="text-gray-400">Sin marcar: <strong>{bookings.length - attended - absent}</strong></span>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {bookings.map((b) => {
          const student = b.student
          const initials = (student?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
          const isLoading = saving === b.id

          return (
            <div key={b.id} className="flex items-center gap-4 px-6 py-4">
              {student?.avatar_url ? (
                <img src={student.avatar_url} className="h-10 w-10 rounded-full object-cover" alt={student.name} />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{student?.name}</p>
                <p className="text-sm text-gray-400">{student?.email}</p>
              </div>
              {student?.currentLevel && (
                <span
                  className="hidden sm:inline rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: student.currentLevel.color }}
                >
                  {student.currentLevel.name}
                </span>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => markStatus(b.id, 'confirmed')}
                  disabled={isLoading}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${b.status === 'confirmed' ? 'bg-green-600 text-white' : 'border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-600'}`}
                >
                  {isLoading ? '...' : '✓'}
                </button>
                <button
                  onClick={() => markStatus(b.id, 'no_show')}
                  disabled={isLoading}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${b.status === 'no_show' ? 'bg-red-500 text-white' : 'border border-gray-200 text-gray-500 hover:border-red-400 hover:text-red-500'}`}
                >
                  {isLoading ? '...' : '✗'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
