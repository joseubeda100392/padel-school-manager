'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Exclusion {
  id: string
  excluded_date: string
  reason: string | null
  student_name: string
}

interface Enrollment {
  id: string
  student: { id: string; name: string }
}

export default function ScheduleExclusions({ scheduleId, enrollments }: { scheduleId: string; enrollments: Enrollment[] }) {
  const [exclusions, setExclusions] = useState<Exclusion[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ enrollmentId: '', date: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [scheduleId])

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('schedule_exclusions')
      .select('id, excluded_date, reason, group_enrollment:group_enrollments(student:users(name))')
      .in('group_enrollment_id', enrollments.map((e) => e.id))
      .order('excluded_date', { ascending: false })
    setExclusions((data ?? []).map((e: any) => ({
      id: e.id,
      excluded_date: e.excluded_date,
      reason: e.reason,
      student_name: e.group_enrollment?.student?.name ?? '—',
    })))
  }

  async function handleAdd() {
    if (!form.enrollmentId || !form.date) { setError('Selecciona alumno y fecha'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/schedule-exclusions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_enrollment_id: form.enrollmentId,
        excluded_date: form.date,
        reason: form.reason || null,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error ?? 'Error'); return }
    setForm({ enrollmentId: '', date: '', reason: '' })
    setOpen(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Quitar esta exclusión?')) return
    await fetch('/api/schedule-exclusions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setExclusions((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="font-semibold text-gray-900">Clases puntuales canceladas</h2>
          <p className="text-xs text-gray-400">Faltas individuales sin dar de baja al alumno</p>
        </div>
        <button onClick={() => setOpen((o) => !o)}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600">
          + Añadir
        </button>
      </div>

      {open && (
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Alumno *</label>
              <select value={form.enrollmentId} onChange={(e) => setForm({ ...form, enrollmentId: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                <option value="">Seleccionar...</option>
                {enrollments.map((e) => (
                  <option key={e.id} value={e.id}>{e.student.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Fecha de la clase cancelada *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">Motivo (opcional)</label>
              <input type="text" value={form.reason} placeholder="Ej: Viaje, enfermedad..."
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setOpen(false); setError('') }}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100">
              Cancelar
            </button>
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 rounded-lg bg-orange-500 py-2 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-60">
              {saving ? 'Guardando...' : 'Registrar falta'}
            </button>
          </div>
        </div>
      )}

      {exclusions.length === 0 ? (
        <p className="px-6 py-6 text-center text-sm text-gray-400">Sin cancelaciones puntuales registradas.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {exclusions.map((e) => (
            <li key={e.id} className="flex items-center gap-4 px-6 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{e.student_name}</p>
                <p className="text-xs text-gray-400">
                  {new Date(e.excluded_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {e.reason && ` · ${e.reason}`}
                </p>
              </div>
              <button onClick={() => handleDelete(e.id)}
                className="shrink-0 text-xs text-red-400 hover:text-red-600">
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
