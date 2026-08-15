'use client'

import { useState } from 'react'

type OpenMatch = {
  playtomic_match_id: string
  court_name: string | null
  slot_datetime: string
  level_min: number | null
  level_max: number | null
}

type Props = {
  optedIn: boolean
  level: number | null
  matches: OpenMatch[]
  preferredDays: number[] | null
  preferredStart: string | null
  preferredEnd: string | null
}

// 0=domingo ... 6=sábado (mismo criterio que getDayOfWeek en lib/utils.ts).
// Se muestran empezando en lunes, orden habitual en España.
const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
]

export function PistaVivaOptin({ optedIn, level, matches, preferredDays, preferredStart, preferredEnd }: Props) {
  const [isOptedIn, setIsOptedIn] = useState(optedIn)
  const [currentLevel, setCurrentLevel] = useState(level)
  const [profileUrl, setProfileUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [selectedDays, setSelectedDays] = useState<number[]>(preferredDays ?? [])
  const [prefStart, setPrefStart] = useState(preferredStart ?? '')
  const [prefEnd, setPrefEnd] = useState(preferredEnd ?? '')
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsSaved, setPrefsSaved] = useState(false)

  function toggleDay(day: number) {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
    setPrefsSaved(false)
  }

  async function handleSavePreferences() {
    setSavingPrefs(true)
    setPrefsSaved(false)
    try {
      await fetch('/api/student/pista-viva/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredDays: selectedDays, preferredStart: prefStart || null, preferredEnd: prefEnd || null }),
      })
      setPrefsSaved(true)
    } finally {
      setSavingPrefs(false)
    }
  }

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/student/pista-viva/optin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrl }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al activar'); return }
      setIsOptedIn(true)
      setCurrentLevel(data.level ?? null)
      setProfileUrl('')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeactivate() {
    setLoading(true)
    try {
      await fetch('/api/student/pista-viva/optin', { method: 'DELETE' })
      setIsOptedIn(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Pista Viva ⚡</h2>
        <p className="mt-1 text-xs text-gray-500">
          Recibe un aviso cuando falte 1 jugador para un partido de tu nivel en el club.
        </p>
      </div>

      {isOptedIn ? (
        <>
          <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-brand-700">Avisos activados</p>
              {currentLevel != null && (
                <p className="text-xs text-brand-600">Tu nivel Playtomic: {currentLevel.toFixed(2)}</p>
              )}
            </div>
            <button
              onClick={handleDeactivate}
              disabled={loading}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
            >
              Desactivar
            </button>
          </div>

          <div className="space-y-2 rounded-lg border border-gray-100 p-3">
            <p className="text-xs font-medium text-gray-700">¿Cuándo te interesa jugar? (vacío = cualquier día/hora)</p>
            <div className="flex gap-1.5">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`h-8 w-8 rounded-full text-xs font-semibold transition-colors ${
                    selectedDays.includes(d.value) ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={prefStart}
                onChange={(e) => { setPrefStart(e.target.value); setPrefsSaved(false) }}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-gray-400">a</span>
              <input
                type="time"
                value={prefEnd}
                onChange={(e) => { setPrefEnd(e.target.value); setPrefsSaved(false) }}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={savingPrefs}
                className="ml-auto rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-60"
              >
                {savingPrefs ? 'Guardando...' : prefsSaved ? '✓ Guardado' : 'Guardar'}
              </button>
            </div>
          </div>

          {matches.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Partidos de tu nivel ahora mismo</p>
              {matches.map((m) => {
                const date = new Date(m.slot_datetime)
                return (
                  <a
                    key={m.playtomic_match_id}
                    href={`https://app.playtomic.io/matches/${m.playtomic_match_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2.5 text-sm hover:border-brand-300 hover:bg-brand-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{m.court_name ?? 'Pista'}</p>
                      <p className="text-xs text-gray-500">
                        {date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })}
                        {' · '}
                        {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-brand-600">Apuntarme →</span>
                  </a>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Ahora mismo no hay partidos abiertos de tu nivel en el club.</p>
          )}
        </>
      ) : (
        <form onSubmit={handleActivate} className="space-y-2">
          <label className="block text-xs font-medium text-gray-500">
            Pega el enlace de tu perfil de Playtomic (Compartir perfil → Copiar enlace)
          </label>
          <input
            type="url"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            required
            placeholder="https://app.playtomic.com/profile/user/..."
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {error && <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !profileUrl}
            className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Comprobando...' : 'Activar avisos'}
          </button>
        </form>
      )}
    </div>
  )
}
