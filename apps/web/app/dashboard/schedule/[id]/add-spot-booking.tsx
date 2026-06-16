'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface Student { id: string; name: string; email: string }

interface Props {
  scheduleId: string
  nextDate: string
  availableStudents: Student[]
  clubId: string | null
  existingBookings: { studentId: string; classDate: string }[]
}

export function AdminAddSpotBooking({ scheduleId, nextDate, availableStudents, clubId, existingBookings }: Props) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [date, setDate] = useState(nextDate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showList, setShowList] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const bookedOnDate = useMemo(() => {
    return new Set(existingBookings.filter(b => b.classDate === date).map(b => b.studentId))
  }, [existingBookings, date])

  const filtered = useMemo(() => {
    const eligible = availableStudents.filter(s => !bookedOnDate.has(s.id))
    if (!q.trim()) return eligible.slice(0, 8)
    const lower = q.toLowerCase()
    return eligible
      .filter(s => s.name.toLowerCase().includes(lower) || s.email.toLowerCase().includes(lower))
      .slice(0, 8)
  }, [q, availableStudents, bookedOnDate])

  function selectStudent(s: Student) {
    setSelectedStudent(s)
    setQ(s.name)
    setShowList(false)
    setError('')
  }

  async function handleAdd() {
    if (!selectedStudent) { setError('Selecciona un alumno'); return }
    if (!date) { setError('Selecciona una fecha'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/bookings/spot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId, studentId: selectedStudent.id, classDate: date, clubId }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Error al añadir la reserva')
      setSaving(false)
      return
    }
    setQ('')
    setSelectedStudent(null)
    setDate(nextDate)
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="border-t border-gray-100 px-6 py-4">
      <p className="mb-3 text-sm font-medium text-gray-700">Añadir alumno para una clase</p>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <input
            type="text"
            placeholder="Buscar alumno por nombre o email..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setSelectedStudent(null); setShowList(true) }}
            onFocus={() => setShowList(true)}
            onBlur={() => setTimeout(() => setShowList(false), 150)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          {showList && filtered.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
              {filtered.map(s => (
                <li
                  key={s.id}
                  onMouseDown={() => selectStudent(s)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{s.name}</span>
                  <span className="ml-2 text-gray-400">{s.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={saving || !selectedStudent}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? '...' : 'Añadir'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
