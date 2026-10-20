'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Button, buttonVariants } from '@/components/ui/button'
import { LevelTag } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function NewTournamentPage() {
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
    status: 'open' as 'open' | 'closed',
  })

  useEffect(() => {
    fetch('/api/admin/levels').then(r => r.json()).then(({ levels }) => {
      if (levels) setLevels(levels)
    })
  }, [])

  function toggleLevel(id: string) {
    setAllowedLevelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/tournaments', {
      method: 'POST',
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
      setError(j.error ?? 'Error al crear el torneo')
      return
    }
    window.location.href = '/dashboard/tournaments'
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <PageHeader title="Nuevo torneo" back={{ href: '/dashboard/tournaments', label: 'Torneos' }} />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nombre del torneo">
              <Input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Torneo de verano 2026"
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
                placeholder="Ej: Pista 1 y 2"
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
              <Field label="Precio de inscripción (€)">
                <Input
                  type="text"
                  inputMode="numeric"
                  onFocus={e => e.target.select()}
                  min={0}
                  step={0.5}
                  value={form.price_cents}
                  onChange={e => setForm({ ...form, price_cents: Number(e.target.value) })}
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
                placeholder="Información adicional sobre el torneo"
              />
            </Field>

            <fieldset>
              <legend className="text-label text-ink">Estado inicial</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[{ value: 'open', label: 'Abierto (inscripciones activas)' }, { value: 'closed', label: 'Cerrado' }].map(opt => (
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
              <Link href="/dashboard/tournaments" className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
                Cancelar
              </Link>
              <Button type="submit" loading={saving} className="w-full sm:w-auto">
                {saving ? 'Creando…' : 'Crear torneo'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
