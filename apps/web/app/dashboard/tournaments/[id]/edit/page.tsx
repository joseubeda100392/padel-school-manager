'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Button, buttonVariants } from '@/components/ui/button'
import { LevelTag } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/feedback'
import { cn } from '@/lib/utils'

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

      const [{ data: tournament }, levelsData] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        fetch('/api/admin/levels').then(r => r.json()),
      ])
      const lvls = levelsData.levels ?? []

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
    return (
      <div className="mx-auto w-full max-w-xl space-y-6" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <PageHeader title="Editar torneo" back={{ href: `/dashboard/tournaments/${id}`, label: 'Torneo' }} />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nombre">
              <Input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </Field>

            <Field label="Fecha">
              <Input
                type="date"
                required
                value={form.tournament_date}
                onChange={e => setForm({ ...form, tournament_date: e.target.value })}
              />
            </Field>

            <Field label="Lugar o pista">
              <Input
                type="text"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Plazas máximas">
                <Input
                  type="text"
                  inputMode="numeric"
                  onFocus={e => e.target.select()}
                  min={2}
                  max={256}
                  value={form.max_players}
                  onChange={e => setForm({ ...form, max_players: Number(e.target.value) })}
                  className="tabular-nums"
                />
              </Field>
              <Field label="Precio (€)">
                <Input
                  type="text"
                  inputMode="numeric"
                  onFocus={e => e.target.select()}
                  min={0}
                  step={0.5}
                  value={form.price_cents === 0 ? '' : form.price_cents}
                  onChange={e => setForm({ ...form, price_cents: Number(e.target.value) })}
                  placeholder="0"
                  className="tabular-nums"
                />
              </Field>
            </div>

            {levels.length > 0 && (
              <fieldset>
                <legend className="text-label text-ink">Niveles permitidos</legend>
                <p className="mt-0.5 text-meta text-ink-3">
                  {allowedLevelIds.length === 0 ? 'Abierto a todos los niveles. Elige alguno para limitarlo.' : 'Solo podrán apuntarse los niveles elegidos.'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {levels.map(l => {
                    const selected = allowedLevelIds.includes(l.id)
                    return (
                      <button
                        key={l.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleLevel(l.id)}
                        className={cn(
                          'min-h-11 rounded-full border px-4 transition-colors',
                          selected ? 'border-accent-ink bg-accent-soft' : 'border-line-strong/60 bg-surface hover:bg-surface-2',
                        )}
                      >
                        <LevelTag name={l.name} color={l.color} />
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )}

            <Field label="Descripción">
              <Textarea
                rows={3}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </Field>

            <fieldset>
              <legend className="text-label text-ink">Estado</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { value: 'open', label: 'Abierto' },
                  { value: 'closed', label: 'Cerrado' },
                  { value: 'finished', label: 'Finalizado' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={form.status === opt.value}
                    onClick={() => setForm({ ...form, status: opt.value as any })}
                    className={cn(
                      'min-h-11 rounded-full border px-4 text-label transition-colors',
                      form.status === opt.value
                        ? 'border-accent-ink bg-accent-soft text-accent-ink'
                        : 'border-line-strong/60 bg-surface text-ink-2 hover:bg-surface-2',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link href={`/dashboard/tournaments/${id}`} className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
                Cancelar
              </Link>
              <Button type="submit" loading={saving} className="w-full sm:w-auto">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
