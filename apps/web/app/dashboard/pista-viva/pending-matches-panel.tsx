'use client'

import { useState } from 'react'

type PendingMatch = {
  booking_id: string
  court_name: string | null
  start_label: string
  num_participantes: number
  faltan: number
  level_min: number | null
  level_max: number | null
}

export function PendingMatchesPanel() {
  const [matches, setMatches] = useState<PendingMatch[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function checkNow() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/pista-viva/pending-matches', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al consultar Playtomic'); return }
      setMatches(data.matches ?? [])
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Comprobar partidos pendientes ahora</h2>
          <p className="text-sm text-gray-500">Consulta en directo (próximos 14 días), sin esperar al siguiente escaneo automático</p>
        </div>
        <button
          onClick={checkNow}
          disabled={loading}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {loading ? 'Consultando...' : '🔍 Comprobar ahora'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          ⚠️ {error}
        </div>
      )}

      {matches && matches.length === 0 && !error && (
        <p className="mt-4 text-center text-sm text-gray-400">No hay partidos pendientes de jugadores ahora mismo.</p>
      )}

      {matches && matches.length > 0 && (
        <div className="mt-4 space-y-2">
          {matches.map((m) => (
            <div key={m.booking_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 shadow-sm">
              <div>
                <p className="text-sm font-medium text-gray-900">{m.court_name ?? 'Pista'} · {m.start_label}</p>
                <p className="text-xs text-gray-500">
                  Faltan {m.faltan} jugador{m.faltan === 1 ? '' : 'es'}
                  {m.level_min != null && m.level_max != null && ` · Nivel estimado ${m.level_min.toFixed(2)} - ${m.level_max.toFixed(2)}`}
                </p>
              </div>
              <a
                href={`https://app.playtomic.io/matches/${m.booking_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Ver en Playtomic →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
