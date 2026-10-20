'use client'

import { useState } from 'react'
import { BellRing, Check, ExternalLink } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { List } from '@/components/ui/list'
import { formatClock, formatLongDate } from '@/lib/format-date'

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
const DAY_OPTIONS: { value: number; label: string; name: string }[] = [
  { value: 1, label: 'L', name: 'Lunes' },
  { value: 2, label: 'M', name: 'Martes' },
  { value: 3, label: 'X', name: 'Miércoles' },
  { value: 4, label: 'J', name: 'Jueves' },
  { value: 5, label: 'V', name: 'Viernes' },
  { value: 6, label: 'S', name: 'Sábado' },
  { value: 0, label: 'D', name: 'Domingo' },
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
      if (!res.ok) { setError(data.error ?? 'No se ha podido activar. Revisa el enlace.'); return }
      setIsOptedIn(true)
      setCurrentLevel(data.level ?? null)
      setProfileUrl('')
    } catch {
      setError('Sin conexión. Vuelve a intentarlo.')
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
    <Card>
      <CardHeader
        title="Pista Viva"
        description="Te avisamos cuando falte un jugador para un partido de tu nivel en el club."
        action={isOptedIn ? <Badge tone="success"><BellRing className="h-3.5 w-3.5" aria-hidden />Activados</Badge> : undefined}
      />

      {isOptedIn ? (
        <div className="space-y-5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-body text-ink-2">
              {currentLevel != null
                ? <>Tu nivel en Playtomic: <span className="font-medium tabular-nums text-ink">{currentLevel.toFixed(2)}</span></>
                : 'Avisos activados.'}
            </p>
            <Button variant="ghost" size="sm" onClick={handleDeactivate} loading={loading}>Desactivar avisos</Button>
          </div>

          <fieldset className="space-y-3 border-t border-line pt-4">
            <legend className="text-label text-ink">Cuándo te viene bien jugar</legend>
            <p className="-mt-1 text-meta text-ink-3">Déjalo vacío si te vale cualquier día y hora.</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días">
              {DAY_OPTIONS.map((d) => {
                const on = selectedDays.includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={on}
                    aria-label={d.name}
                    onClick={() => toggleDay(d.value)}
                    className={`h-11 w-11 rounded-full text-label transition-colors duration-150 ${
                      on ? 'bg-chrome text-white' : 'border border-line-strong/50 bg-surface text-ink-2 hover:bg-surface-2'
                    }`}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Desde" className="w-32">
                <Input type="time" value={prefStart} onChange={(e) => { setPrefStart(e.target.value); setPrefsSaved(false) }} />
              </Field>
              <Field label="Hasta" className="w-32">
                <Input type="time" value={prefEnd} onChange={(e) => { setPrefEnd(e.target.value); setPrefsSaved(false) }} />
              </Field>
              <Button variant="secondary" onClick={handleSavePreferences} loading={savingPrefs}>
                {prefsSaved ? <><Check className="h-4 w-4" aria-hidden />Guardado</> : 'Guardar'}
              </Button>
            </div>
          </fieldset>

          <div className="border-t border-line pt-4">
            <p className="text-label text-ink">Partidos abiertos de tu nivel</p>
            {matches.length > 0 ? (
              <List className="-mx-4 mt-2 border-y border-line sm:-mx-5">
                {matches.map((m) => (
                  <li key={m.playtomic_match_id}>
                    <a
                      href={`https://app.playtomic.io/matches/${m.playtomic_match_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-ink/[0.03] sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.9375rem] font-medium text-ink">{formatLongDate(m.slot_datetime)} · {formatClock(m.slot_datetime)}</p>
                        <p className="text-meta text-ink-3">{m.court_name ?? 'Pista'}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-label text-accent-ink">
                        Apuntarme en Playtomic<ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </a>
                  </li>
                ))}
              </List>
            ) : (
              <p className="mt-1 text-meta text-ink-3">Ahora mismo no hay partidos abiertos de tu nivel.</p>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleActivate} className="space-y-4 p-4 sm:p-5">
          <Field
            label="Enlace de tu perfil de Playtomic"
            hint="En Playtomic: tu perfil → Compartir perfil → Copiar enlace."
            error={error || undefined}
          >
            <Input type="url" inputMode="url" value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} required placeholder="https://app.playtomic.com/profile/user/…" />
          </Field>
          <Button type="submit" loading={loading} disabled={!profileUrl} block className="sm:w-auto">
            {loading ? 'Comprobando tu perfil' : 'Activar avisos'}
          </Button>
        </form>
      )}
    </Card>
  )
}
