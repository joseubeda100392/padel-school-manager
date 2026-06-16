'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function NewTournamentPage() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [levels, setLevels] = useState<{ id: string; name: string; color: string }[]>([])
  const [allowedLevelIds, setAllowedLevelIds] = useState<string[]>([])
  const [form, setForm] = useState({
    name: '',
    description: '',
    tournament_date: '',
    location: '',
    max_players: 16,
    price_cents: 0,
    status: 'open' as 'open' | 'closed',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: userData } = await supabase.from('users').select('club_id').eq('id', user.id).single()
      const cid = userData?.club_id ?? null
      if (!cid) return
      const { data } = await supabase.from('levels').select('id, name, color').eq('club_id', cid).order('order')
      if (data) setLevels(data)
    })
  }, [])

  function toggleLevel(id: string) {
    setAllowedLevelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        price_cents: Math.round(form.price_cents * 100),
        allowed_level_ids: allowedLevelIds,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Error al crear el torneo')
      return
    }
    window.location.href = '/dashboard/tournaments'
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo torneo</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre del torneo *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Torneo de Verano 2026"
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Fecha *</label>
          <input
            type="date"
            required
            value={form.tournament_date}
            onChange={e => setForm({ ...form, tournament_date: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Lugar / Pista</label>
          <input
            type="text"
            value={form.location}
            onChange={e => setForm({ ...form, location: e.target.value })}
            placeholder="Ej: Pista 1 y 2"
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Plazas máximas</label>
            <input
              type="number"
              min={2}
              max={256}
              value={form.max_players}
              onChange={e => setForm({ ...form, max_players: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio de inscripción (€)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.price_cents}
              onChange={e => setForm({ ...form, price_cents: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {levels.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Niveles permitidos
              <span className="ml-1 text-xs font-normal text-gray-400">(deja vacío para abrir a todos)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {levels.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleLevel(l.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
                    allowedLevelIds.includes(l.id)
                      ? 'text-white border-transparent'
                      : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={allowedLevelIds.includes(l.id) ? { backgroundColor: l.color, borderColor: l.color } : {}}
                >
                  {l.name}
                </button>
              ))}
            </div>
            {allowedLevelIds.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">Abierto a todos los niveles</p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Información adicional sobre el torneo..."
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Estado inicial</label>
          <div className="flex gap-3">
            {[{ value: 'open', label: 'Abierto (inscripciones activas)' }, { value: 'closed', label: 'Cerrado' }].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm({ ...form, status: opt.value as any })}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  form.status === opt.value ? 'bg-brand-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <a
            href="/dashboard/tournaments"
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? 'Creando...' : 'Crear torneo'}
          </button>
        </div>
      </form>
    </div>
  )
}
