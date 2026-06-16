'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PayButton } from '@/components/pay-button'

export function TournamentDetailClient({
  tournamentId,
  status,
  priceCents,
  maxPlayers,
  registeredCount,
  isRegistered: initialRegistered,
}: {
  tournamentId: string
  status: string
  priceCents: number
  maxPlayers: number
  registeredCount: number
  isRegistered: boolean
}) {
  const [registered, setRegistered] = useState(initialRegistered)
  const [count, setCount] = useState(registeredCount)
  const [loading, setLoading] = useState(false)

  const isFull = count >= maxPlayers && !registered
  const canRegister = status === 'open' && !registered && !isFull

  async function handleRegister() {
    setLoading(true)
    const res = await fetch('/api/tournaments/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId }),
    })
    const j = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { toast.error(j.error ?? 'Error al inscribirse'); return }
    toast.success('¡Inscrito correctamente!')
    setRegistered(true)
    setCount(c => c + 1)
  }

  async function handleCancel() {
    if (!confirm('¿Cancelar tu inscripción en este torneo?')) return
    setLoading(true)
    const res = await fetch('/api/tournaments/register', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId }),
    })
    setLoading(false)
    if (!res.ok) { toast.error('Error al cancelar la inscripción'); return }
    toast.success('Inscripción cancelada')
    setRegistered(false)
    setCount(c => Math.max(0, c - 1))
  }

  if (registered) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-lg bg-brand-50 px-4 py-2.5">
          <p className="text-sm font-semibold text-brand-700">✓ Estás inscrito</p>
        </div>
        {status === 'open' && (
          <button
            onClick={handleCancel}
            disabled={loading}
            className="rounded-lg border border-red-100 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            {loading ? '...' : 'Cancelar inscripción'}
          </button>
        )}
      </div>
    )
  }

  if (!canRegister) {
    return (
      <p className="text-sm text-gray-400 text-center">
        {isFull ? 'Torneo completo' : status === 'closed' ? 'Inscripciones cerradas' : 'Torneo finalizado'}
      </p>
    )
  }

  if (priceCents > 0) {
    return (
      <div className="space-y-2">
        <PayButton
          type="tournament"
          tournamentId={tournamentId}
          label={`Pagar y apuntarme — ${(priceCents / 100).toFixed(2)} €`}
          className="w-full rounded-lg bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        />
        <p className="text-center text-xs text-gray-400">La inscripción no es reembolsable</p>
      </div>
    )
  }

  return (
    <button
      onClick={handleRegister}
      disabled={loading}
      className="w-full rounded-lg bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
    >
      {loading ? 'Procesando...' : 'Apuntarme al torneo'}
    </button>
  )
}
