'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function NewSchedulePage() {
  const [courts, setCourts] = useState<any[]>([])
  const [coaches, setCoaches] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [form, setForm] = useState({
    court_id: '',
    coach_id: '',
    level_id: '',
    date: '',
    start_time: '09:00',
    end_time: '10:00',
    recurrence: 'weekly',
    max_students: 4,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clubId, setClubId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const cid = user?.user_metadata?.club_id ?? null
      setClubId(cid)
      const courtsQ = supabase.from('courts').select('id, name').eq('is_active', true).order('name')
      const coachesQ = supabase.from('users').select('id, name').eq('role', 'coach').eq('is_active', true).order('name')
      const levelsQ = supabase.from('levels').select('id, name, color').order('order')
      Promise.all([
        cid ? courtsQ.eq('club_id', cid) : courtsQ,
        cid ? coachesQ.eq('club_id', cid) : coachesQ,
        cid ? levelsQ.eq('club_id', cid) : levelsQ,
      ]).then(([{ data: c }, { data: u }, { data: l }]) => {
        if (c) setCourts(c)
        if (u) setCoaches(u)
        if (l) setLevels(l)
      })
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.court_id) { setError('Selecciona una pista'); return }
    if (!form.coach_id) { setError('Selecciona un monitor'); return }
    if (!form.date) { setError('Selecciona una fecha'); return }

    setLoading(true)
    setError('')

    const startDateTime = new Date(`${form.date}T${form.start_time}:00`)
    const endDateTime = new Date(`${form.date}T${form.end_time}:00`)

    if (endDateTime <= startDateTime) {
      setError('La hora de fin debe ser posterior a la de inicio')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: err } = await supabase.from('schedules').insert({
      court_id: form.court_id,
      coach_id: form.coach_id,
      level_id: form.level_id || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      recurrence: form.recurrence,
      max_students: form.max_students,
      is_active: true,
      club_id: clubId,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    window.location.href = '/dashboard/schedule'
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <a href="/dashboard/schedule" className="text-sm text-gray-500 hover:text-gray-700">
          ← Horarios
        </a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Nueva clase</h1>
      </div>

      {courts.length === 0 && (
        <div className="mb-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          No hay pistas activas. <a href="/dashboard/settings" className="font-medium underline">Créalas primero en Configuración</a>.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Pista *</label>
          <select
            value={form.court_id}
            onChange={(e) => setForm({ ...form, court_id: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">Selecciona pista...</option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Monitor *</label>
          <select
            value={form.coach_id}
            onChange={(e) => setForm({ ...form, coach_id: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">Selecciona monitor...</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nivel requerido</label>
          <select
            value={form.level_id}
            onChange={(e) => setForm({ ...form, level_id: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">Abierto a todos los niveles</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">Solo verán esta clase los alumnos con ese nivel asignado.</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Fecha de inicio *</label>
          <input
            type="date"
            value={form.date}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Hora inicio *</label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Hora fin *</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Recurrencia</label>
            <select
              value={form.recurrence}
              onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="none">Clase única</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Máx. alumnos</label>
            <input
              type="number"
              min={1}
              max={20}
              value={form.max_students}
              onChange={(e) => setForm({ ...form, max_students: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <a
            href="/dashboard/schedule"
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? 'Guardando...' : 'Crear clase'}
          </button>
        </div>
      </form>
    </div>
  )
}
