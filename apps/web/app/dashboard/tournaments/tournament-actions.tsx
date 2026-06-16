'use client'

import { useState } from 'react'

const nextStatus: Record<string, { label: string; status: string }> = {
  open: { label: 'Cerrar inscripciones', status: 'closed' },
  closed: { label: 'Marcar finalizado', status: 'finished' },
}

export function TournamentActions({ tournamentId, currentStatus }: { tournamentId: string; currentStatus: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm('¿Eliminar este torneo? Se borrarán todas las inscripciones.')) return
    setLoading(true)
    await fetch(`/api/admin/tournaments/${tournamentId}`, { method: 'DELETE' })
    window.location.reload()
  }

  async function handleStatusChange(newStatus: string) {
    setLoading(true)
    await fetch(`/api/admin/tournaments/${tournamentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    window.location.reload()
  }

  const next = nextStatus[currentStatus]

  return (
    <div className="flex items-center gap-2">
      {next && (
        <button
          onClick={() => handleStatusChange(next.status)}
          disabled={loading}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          {next.label}
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
      >
        Eliminar
      </button>
    </div>
  )
}
