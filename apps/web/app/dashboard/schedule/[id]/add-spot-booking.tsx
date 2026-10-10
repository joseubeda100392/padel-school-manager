'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'

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
    if (typeof json.newBalance === 'number') {
      toast.success(`Clase descontada de su bolsa · saldo restante: ${json.newBalance}`)
    }
    setQ('')
    setSelectedStudent(null)
    setDate(nextDate)
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="border-t border-line px-4 py-4 sm:px-5">
      <p className="mb-3 text-label text-ink">Añadir alumno para una clase</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Alumno" className="relative min-w-0 flex-1">
          <Input
            type="text"
            autoComplete="off"
            placeholder="Nombre o email"
            value={q}
            onChange={(e) => { setQ(e.target.value); setSelectedStudent(null); setShowList(true) }}
            onFocus={() => setShowList(true)}
            onBlur={() => setTimeout(() => setShowList(false), 150)}
          />
          {showList && filtered.length > 0 && (
            <ul className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-control border border-line bg-surface shadow-overlay">
              {filtered.map(s => (
                <li
                  key={s.id}
                  onMouseDown={() => selectStudent(s)}
                  className="cursor-pointer px-3.5 py-2.5 text-body hover:bg-ink/[0.04]"
                >
                  <span className="font-medium text-ink">{s.name}</span>
                  <span className="ml-2 text-meta text-ink-3">{s.email}</span>
                </li>
              ))}
            </ul>
          )}
        </Field>
        <Field label="Fecha de la clase" className="sm:w-48">
          <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Button onClick={handleAdd} disabled={saving || !selectedStudent} loading={saving} className="w-full sm:w-auto">
          Añadir alumno
        </Button>
      </div>
      {error && <p role="alert" className="mt-2 text-meta font-medium text-danger-ink">{error}</p>}
    </div>
  )
}
