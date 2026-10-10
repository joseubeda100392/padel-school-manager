'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CircleCheck } from 'lucide-react'
import { PayButton } from '@/components/pay-button'
import { useConfirm } from '@/components/ui/confirm'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'

export function TournamentDetailClient({
  tournamentId,
  status,
  priceCents,
  maxPlayers,
  registeredCount,
  isRegistered: initialRegistered,
  cashOnly = false,
}: {
  tournamentId: string
  status: string
  priceCents: number
  maxPlayers: number
  registeredCount: number
  isRegistered: boolean
  cashOnly?: boolean
}) {
  const confirm = useConfirm()
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
    if (!res.ok) { toast.error(j.error ?? 'No se ha podido completar la inscripción. Inténtalo de nuevo.'); return }
    toast.success('Te has apuntado al torneo')
    setRegistered(true)
    setCount(c => c + 1)
  }

  async function handleCancel() {
    const ok = await confirm({
      title: '¿Cancelar tu inscripción?',
      description: 'Dejarás de estar apuntado a este torneo.',
      confirmLabel: 'Cancelar inscripción',
      destructive: true,
    })
    if (!ok) return
    setLoading(true)
    const res = await fetch('/api/tournaments/register', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId }),
    })
    setLoading(false)
    if (!res.ok) { toast.error('No se ha podido cancelar la inscripción. Inténtalo de nuevo.'); return }
    toast.success('Inscripción cancelada')
    setRegistered(false)
    setCount(c => Math.max(0, c - 1))
  }

  if (registered) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone="success" className="px-3 py-1.5 text-label">
          <CircleCheck className="h-4 w-4" aria-hidden />
          Estás inscrito
        </Badge>
        {status === 'open' && (
          <Button variant="danger-ghost" onClick={handleCancel} loading={loading} className="w-full sm:w-auto">
            Cancelar inscripción
          </Button>
        )}
      </div>
    )
  }

  if (!canRegister) {
    return (
      <p className="text-center text-body text-ink-3">
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
          label={`Pagar y apuntarme · ${(priceCents / 100).toFixed(2)} €`}
          className={buttonVariants({ variant: 'primary', size: 'lg', block: true })}
          cashOnly={cashOnly}
        />
        <p className="text-center text-meta text-ink-3">La inscripción no es reembolsable</p>
      </div>
    )
  }

  return (
    <Button size="lg" block onClick={handleRegister} loading={loading}>
      Apuntarme al torneo
    </Button>
  )
}
