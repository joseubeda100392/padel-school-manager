'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function EditSchedulePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [courts, setCourts] = useState<any[]>([])
  const [coaches, setCoaches] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [form, setForm] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const cid = user?.user_metadata?.club_id ?? null
      Promise.all([
        supabase.from('schedules').select('*').eq('id', params.id).single(),
        cid ? supabase.from('courts').select('id, name').eq('is_active', true).eq('club_id', cid) : supabase.from('courts').select('id, name').eq('is_active', true),
        cid ? supabase.from('users').select('id, name').eq('role', 'coach').eq('club_id', cid) : supabase.from('users').select('id, name').eq('role', 'coach'),
        cid ? supabase.from('levels').select('id, name, color').eq('club_id', cid).order('order') : supabase.from('levels').select('id, name, color').order('order'),
      ]).then(([{ data: s }, { data: c }, { data: u }, { data: l }]) => {
        if (s) {
          const start = new Date(s.start_time)
          const end = new Date(s.end_time)
          const diffMin = Math.round((end.getTime() - start.getTime()) / 60000)
          const duration = diffMin === 90 ? 90 : 60
          setForm({
            court_id: s.court_id ?? '',
            coach_id: s.coach_id ?? '',
            level_id: s.level_id ?? '',
            date: start.toISOString().split('T')[0],
            start_time: start.toTimeString().slice(0, 5),
            duration,
            recurrence: s.recurrence ?? 'weekly',
            max_students: s.max_students ?? 4,
            is_active: s.is_active ?? true,
          })
        }
        if (c) setCourts(c)
        if (u) setCoaches(u)
        if (l) setLevels(l)
      })
    })
  }, [params.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.court_id || !form.coach_id || !form.date) { setError('Rellena los campos obligatorios'); return }

    const startDateTime = new Date(`${form.date}T${form.start_time}:00`)
    const endDateTime = new Date(startDateTime.getTime() + form.duration * 60 * 1000)

    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('schedules').update({
      court_id: form.court_id,
      coach_id: form.coach_id,
      level_id: form.level_id || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      recurrence: form.recurrence,
      max_students: form.max_students,
      is_active: form.is_active,
    }).eq('id', params.id)

    if (err) { setError(err.message); setLoading(false); return }
    router.push(`/dashboard/schedule/${params.id}`)
  }

  if (!form) return <div className="p-8 text-center text-gray-400">Cargando...</div>

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <a href={`/dashboard/schedule/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">← Clase</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Editar clase</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Pista *</label>
          <select value={form.court_id} onChange={(e) => setForm({ ...form, court_id: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none">
            <option value="">Selecciona pista...</option>
            {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Monitor *</label>
          <select value={form.coach_id} onChange={(e) => setForm({ ...form, coach_id: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none">
            <option value="">Selecciona monitor...</option>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nivel requerido</label>
          <select value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none">
            <option value="">Abierto a todos los niveles</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Fecha *</label>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Hora inicio</label>
            <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Duración</label>
            <select value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none">
              <option value={60}>1 hora</option>
              <option value={90}>1 hora 30 min</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Recurrencia</label>
            <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none">
              <option value="none">Clase única</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Máx. alumnos</label>
            <input type="number" min={1} max={20} value={form.max_students}
              onChange={(e) => setForm({ ...form, max_students: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="is_active" checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-green-600" />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Clase activa (visible para alumnos)</label>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <a href={`/dashboard/schedule/${params.id}`}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </a>
          <button type="submit" disabled={loading}
            className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
