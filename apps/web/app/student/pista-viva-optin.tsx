'use client'

import { useState } from 'react'

type Props = {
  optedIn: boolean
  level: number | null
}

export function PistaVivaOptin({ optedIn, level }: Props) {
  const [isOptedIn, setIsOptedIn] = useState(optedIn)
  const [currentLevel, setCurrentLevel] = useState(level)
  const [profileUrl, setProfileUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
