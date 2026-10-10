'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'

const nextStatus: Record<string, { label: string; status: string }> = {
  open: { label: 'Cerrar inscripciones', status: 'closed' },
  closed: { label: 'Marcar finalizado', status: 'finished' },
}

export function TournamentActions({ tournamentId, currentStatus }: { tournamentId: string; currentStatus: string }) {
  const [loading, setLoading] = useState(false)
  const confirm = useConfirm()

  async function handleDelete() {
    if (
      !(await confirm({
        title: 'Eliminar este torneo',
        description: 'Se borrarán también todas las inscripciones. No se puede deshacer.',
        confirmLabel: 'Eliminar torneo',
        destructive: true,
      }))
    )
      return
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
    <div className="flex flex-wrap items-center gap-2">
      {next && (
        <Button variant="secondary" size="sm" onClick={() => handleStatusChange(next.status)} disabled={loading}>
          {next.label}
        </Button>
      )}
      <Button variant="danger-ghost" size="sm" onClick={handleDelete} disabled={loading}>
        Eliminar
      </Button>
    </div>
  )
}
