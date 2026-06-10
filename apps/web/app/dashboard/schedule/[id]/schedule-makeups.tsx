'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Makeup {
  id: string
  student_name: string
  original_date: string | null
  makeup_date: string | null
  status: string
  notes: string | null
}

interface Student {
  id: string
  name: string
}

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  completed: 'Realizada',
  cancelled: 'Cancelada',
}
const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-brand-100 text-brand-600',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function ScheduleMakeups({ scheduleId, students }: { scheduleId: string; students: Student[] }) {
  const [makeups, setMakeups] = useState<Makeup[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ studentId: '', originalDate: '', makeupDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [scheduleId])

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('makeups')
      .select('id, original_date, makeup_date, status, notes, student:users(name)')
      .eq('original_schedule_id', scheduleId)
      .order('created_at', { ascending: false })
    setMakeups((data ?? []).map((m: any) => ({ ...m, student_name: m.student?.name ?? '—' })))
  }

  async function handleAdd() {
    if (!form.studentId) { setError('Selecciona un alumno'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const clubId = user?.user_metadata?.club_id ?? null

    const { error: err } = await supabase.from('makeups').insert({
      student_id: form.studentId,
      club_id: clubId,
      original_schedule_id: scheduleId,
      original_date: form.originalDate || null,
      makeup_date: form.makeupDate || null,
      notes: form.notes || null,
      created_by: user?.id,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm({ studentId: '', originalDate: '', makeupDate: '', notes: '' })
    setOpen(false)
    load()
  }

  async function handleStatus(id: string, status: string) {
    const supabase = createClient()
    await supabase.from('makeups').update({ status }).eq('id', id)
    setMakeups((prev) => prev.map((m) => m.id === id ? { ...m, status } : m))
  }

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="font-semibold text-gray-900">Recuperaciones</h2>
          <p className="text-xs text-gray-400">{makeups.filter(m => m.status === 'pending').length} pendientes</p>
        </div>
        <button onClick={() => setOpen((o) => !o)}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
          + Nueva
        </button>
      </div>

      {open && (
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Alumno *</label>
              <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                <option value="">Seleccionar...</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Fecha clase perdida</label>
              <input type="date" value={form.originalDate}
                onChange={(e) => setForm({ ...form, originalDate: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Fecha recuperación</label>
              <input type="date" value={form.makeupDate}
                onChange={(e) => setForm({ ...form, makeupDate: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Notas</label>
              <input type="text" value={form.notes} placeholder="Opcional"
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
              className="flex-1 rounded-lg bg-brand-500 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar recuperación'}
            </button>
          </div>
        </div>
      )}

      {makeups.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-gray-400">Sin recuperaciones registradas.</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {makeups.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{m.student_name}</p>
                <p className="text-xs text-gray-400">
                  {m.original_date ? `Faltó: ${new Date(m.original_date).toLocaleDateString('es-ES')}` : 'Sin fecha origen'}
                  {m.makeup_date ? ` · Recupera: ${new Date(m.makeup_date).toLocaleDateString('es-ES')}` : ''}
                </p>
                {m.notes && <p className="text-xs text-gray-400 italic">{m.notes}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[m.status]}`}>
                {statusLabel[m.status]}
              </span>
              {m.status === 'pending' && (
                <div className="flex gap-1">
                  <button onClick={() => handleStatus(m.id, 'completed')}
                    className="rounded border border-brand-200 px-2 py-1 text-xs text-brand-500 hover:bg-brand-50">
                    ✓ Realizada
                  </button>
                  <button onClick={() => handleStatus(m.id, 'cancelled')}
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-400 hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
