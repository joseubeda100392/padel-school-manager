'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function EditTournamentPage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
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
    status: 'open' as 'open' | 'closed' | 'finished',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: userData } = await supabase.from('users').select('club_id').eq('id', user.id).single()
      const cid = userData?.club_id ?? null

      const [{ data: tournament }, { data: lvls }] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        cid ? supabase.from('levels').select('id, name, color').eq('club_id', cid).order('order') : Promise.resolve({ data: [] }),
      ])

      if (tournament) {
        setForm({
          name: tournament.name ?? '',
          description: tournament.description ?? '',
          tournament_date: tournament.tournament_date ?? '',
          location: tournament.location ?? '',
          max_players: tournament.max_players ?? 16,
          price_cents: (tournament.price_cents ?? 0) / 100,
          status: tournament.status ?? 'open',
        })
        setAllowedLevelIds(tournament.allowed_level_ids ?? [])
      }
      if (lvls) setLevels(lvls)
      setLoading(false)
    })
  }, [id])

  function toggleLevel(levelId: string) {
    setAllowedLevelIds(prev => prev.includes(levelId) ? prev.filter(x => x !== levelId) : [...prev, levelId])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/tournaments/${id}`, {
      method: 'PATCH',
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
      setError(j.error ?? 'Error al guardar')
      return
    }
    window.location.href = `/dashboard/tournaments/${id}`
  }

  if (loading) {
    return <div className="max-w-lg"><div className="h-8 w-48 animate-pulse rounded-lg bg-gray-100" /></div>
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <a href={`/dashboard/tournaments/${id}`} className="text-sm text-gray-400 hover:text-gray-600">← Torneo</a>
        <span className="text-gray-200">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Editar torneo</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio (€)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.price_cents === 0 ? '' : form.price_cents}
              onChange={e => setForm({ ...form, price_cents: Number(e.target.value) })}
              placeholder="0"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {levels.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Niveles permitidos
              <span className="ml-1 text-xs font-normal text-gray-400">(vacío = todos)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {levels.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleLevel(l.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
                    allowedLevelIds.includes(l.id) ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={allowedLevelIds.includes(l.id) ? { backgroundColor: l.color, borderColor: l.color } : {}}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Estado</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'open', label: 'Abierto' },
              { value: 'closed', label: 'Cerrado' },
              { value: 'finished', label: 'Finalizado' },
            ].map(opt => (
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

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <a
            href={`/dashboard/tournaments/${id}`}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
