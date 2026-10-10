'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CircleCheck, Clock, Lock, Users } from 'lucide-react'
import { PayButton } from '@/components/pay-button'
import { formatLongDate } from '@/lib/format-date'
import { useConfirm } from '@/components/ui/confirm'
import { Card } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'

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

function StatusBadge({ status }: { status: string }) {
  if (status === 'open') {
    return (
      <Badge tone="success">
        <CircleCheck className="h-3.5 w-3.5" aria-hidden />
        Abierto
      </Badge>
    )
  }
  if (status === 'closed') {
    return (
      <Badge tone="warn">
        <Lock className="h-3.5 w-3.5" aria-hidden />
        Cerrado
      </Badge>
    )
  }
  if (status === 'finished') {
    return (
      <Badge tone="neutral">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Finalizado
      </Badge>
    )
  }
  return <Badge tone="neutral">{status}</Badge>
}

export function TournamentsClient({ tournaments, cashOnly = false }: { tournaments: Tournament[]; cashOnly?: boolean }) {
  const confirm = useConfirm()
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
      toast.error(j.error ?? 'No se ha podido completar la inscripción. Inténtalo de nuevo.')
      setStates(prev => ({ ...prev, [tournamentId]: { ...prev[tournamentId], loading: false } }))
      return
    }
    toast.success('Te has apuntado al torneo')
    setStates(prev => ({
      ...prev,
      [tournamentId]: { registered: true, count: prev[tournamentId].count + 1, loading: false },
    }))
  }

  async function handleCancel(tournamentId: string) {
    const ok = await confirm({
      title: '¿Cancelar tu inscripción?',
      description: 'Dejarás de estar apuntado a este torneo.',
      confirmLabel: 'Cancelar inscripción',
      destructive: true,
    })
    if (!ok) return
    setStates(prev => ({ ...prev, [tournamentId]: { ...prev[tournamentId], loading: true } }))
    const res = await fetch('/api/tournaments/register', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId }),
    })
    if (!res.ok) {
      toast.error('No se ha podido cancelar la inscripción. Inténtalo de nuevo.')
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
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line">
        {tournaments.map(t => {
          const state = states[t.id]
          const isFull = state.count >= t.max_players && !state.registered
          const canRegister = t.status === 'open' && !state.registered && !isFull

          return (
            <li key={t.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Link href={`/student/tournaments/${t.id}`} className="text-heading text-ink hover:underline">
                      {t.name}
                    </Link>
                    <StatusBadge status={t.status} />
                    {state.registered && (
                      <Badge tone="success">
                        <CircleCheck className="h-3.5 w-3.5" aria-hidden />
                        Inscrito
                      </Badge>
                    )}
                  </div>
                  <p className="text-body text-ink-2">{formatLongDate(t.tournament_date)}</p>
                  {t.location && <p className="text-body text-ink-3">{t.location}</p>}
                  {t.description && <p className="mt-1 text-body text-ink-2">{t.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-3">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {state.count} / {t.max_players} inscritos
                    </span>
                    <span className="tabular-nums">{t.price_cents > 0 ? `${(t.price_cents / 100).toFixed(2)} €` : 'Gratuito'}</span>
                    {t.allowedLevels && t.allowedLevels.map(l => (
                      <LevelTag key={l.id} name={l.name} color={l.color} />
                    ))}
                  </div>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
                  {state.registered ? (
                    t.status === 'open' ? (
                      <Button
                        variant="danger-ghost"
                        onClick={() => handleCancel(t.id)}
                        loading={state.loading}
                        className="w-full sm:w-auto"
                      >
                        Cancelar inscripción
                      </Button>
                    ) : null
                  ) : canRegister ? (
                    t.price_cents > 0 ? (
                      <div className="flex flex-col gap-1 sm:items-end">
                        <PayButton
                          type="tournament"
                          tournamentId={t.id}
                          label={`Pagar y apuntarme · ${(t.price_cents / 100).toFixed(2)} €`}
                          className={buttonVariants({ variant: 'primary', className: 'w-full sm:w-auto' })}
                          cashOnly={cashOnly}
                        />
                        <p className="text-meta text-ink-3">La inscripción no es reembolsable</p>
                      </div>
                    ) : (
                      <Button onClick={() => handleRegister(t.id)} loading={state.loading} className="w-full sm:w-auto">
                        Apuntarme
                      </Button>
                    )
                  ) : isFull ? (
                    <Badge tone="neutral">Completo</Badge>
                  ) : null}
                  <Link href={`/student/tournaments/${t.id}`} className={buttonVariants({ variant: 'link', size: 'md' })}>
                    Ver información
                  </Link>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
