'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PayButton } from '@/components/pay-button'

type Tournament = {
  id: string
  name: string
  description: string | null
  tournament_date: string
  location: string | null
  max_players: number
  price_cents: number
  status: string
  registeredCount: number
  isRegistered: boolean
  allowedLevels?: { id: string; name: string; color: string }[]
}

const statusLabel: Record<string, string> = { open: 'Abierto', closed: 'Cerrado', finished: 'Finalizado' }
const statusColor: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-yellow-100 text-yellow-700',
  finished: 'bg-gray-100 text-gray-500',
}

export function TournamentsClient({ tournaments }: { tournaments: Tournament[] }) {
  const [states, setStates] = useState<Record<string, { registered: boolean; count: number; loading: boolean }>>(() =>
    Object.fromEntries(tournaments.map(t => [t.id, { registered: t.isRegistered, count: t.registeredCount, loading: false }]))
  )

  async function handleRegister(tournamentId: string) {
    setStates(prev => ({ ...prev, [tournamentId]: { ...prev[tournamentId], loading: true } }))
    const res = await fetch('/api/tournaments/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(j.error ?? 'Error al inscribirse')
      setStates(prev => ({ ...prev, [tournamentId]: { ...prev[tournamentId], loading: false } }))
      return
    }
    toast.success('¡Inscrito correctamente!')
    setStates(prev => ({
      ...prev,
      [tournamentId]: { registered: true, count: prev[tournamentId].count + 1, loading: false },
    }))
  }

  async function handleCancel(tournamentId: string) {
    if (!confirm('¿Cancelar tu inscripción en este torneo?')) return
    setStates(prev => ({ ...prev, [tournamentId]: { ...prev[tournamentId], loading: true } }))
    const res = await fetch('/api/tournaments/register', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId }),
    })
    if (!res.ok) {
      toast.error('Error al cancelar la inscripción')
      setStates(prev => ({ ...prev, [tournamentId]: { ...prev[tournamentId], loading: false } }))
      return
    }
    toast.success('Inscripción cancelada')
    setStates(prev => ({
      ...prev,
      [tournamentId]: { registered: false, count: Math.max(0, prev[tournamentId].count - 1), loading: false },
    }))
  }

  return (
    <div className="space-y-4">
      {tournaments.map(t => {
        const state = states[t.id]
        const dateLabel = new Date(t.tournament_date + 'T12:00:00').toLocaleDateString('es-ES', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        const isFull = state.count >= t.max_players && !state.registered
        const canRegister = t.status === 'open' && !state.registered && !isFull

        return (
          <div key={t.id} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="font-semibold text-gray-900">{t.name}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {statusLabel[t.status] ?? t.status}
                  </span>
                  {state.registered && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                      Inscrito
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 capitalize">{dateLabel}</p>
                {t.location && <p className="text-sm text-gray-400">{t.location}</p>}
                {t.description && <p className="mt-1 text-sm text-gray-600">{t.description}</p>}
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-400">{state.count} / {t.max_players} inscritos</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-400">{t.price_cents > 0 ? `${(t.price_cents / 100).toFixed(2)} €` : 'Gratuito'}</span>
                  {t.allowedLevels && t.allowedLevels.length > 0 && (
                    <>
                      <span className="text-xs text-gray-400">·</span>
                      {t.allowedLevels.map(l => (
                        <span
                          key={l.id}
                          className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                          style={{ backgroundColor: l.color }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {state.registered ? (
                  t.status === 'open' ? (
                    <button
                      onClick={() => handleCancel(t.id)}
                      disabled={state.loading}
                      className="rounded-lg border border-red-100 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      {state.loading ? '...' : 'Cancelar'}
                    </button>
                  ) : (
                    <span className="rounded-lg bg-brand-50 px-4 py-2 text-sm font-medium text-brand-600">
                      Inscrito
                    </span>
                  )
                ) : canRegister ? (
                  t.price_cents > 0 ? (
                    <div className="flex flex-col items-end gap-1">
                      <PayButton
                        type="tournament"
                        tournamentId={t.id}
                        label={`Pagar y apuntarme — ${(t.price_cents / 100).toFixed(2)} €`}
                        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
                      />
                      <p className="text-xs text-gray-400">La inscripción no es reembolsable</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRegister(t.id)}
                      disabled={state.loading}
                      className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
                    >
                      {state.loading ? '...' : 'Apuntarme'}
                    </button>
                  )
                ) : isFull ? (
                  <span className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500">Completo</span>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
