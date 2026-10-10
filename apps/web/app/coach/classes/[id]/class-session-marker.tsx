'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleCheck, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'

interface ExistingSession {
  status: 'given' | 'not_given'
  cancel_reason: string | null
  confirmed_by_admin: string | null
  absentStudentIds: string[]
}

export function ClassSessionMarker({
  scheduleId,
  sessionDate,
  sessionDateLabel,
  students,
  existingSession,
}: {
  scheduleId: string
  sessionDate: string
  sessionDateLabel: string
  students: { id: string; name: string }[]
  existingSession: ExistingSession | null
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'given' | 'not_given'>('idle')
  const [absentIds, setAbsentIds] = useState<string[]>(existingSession?.absentStudentIds ?? [])
  const [reason, setReason] = useState(existingSession?.cancel_reason ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(status: 'given' | 'not_given') {
    setSaving(true)
    setError('')
    const res = await fetch('/api/coach/class-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleId,
        sessionDate,
        status,
        reason: status === 'not_given' ? (reason || undefined) : undefined,
        absentStudentIds: status === 'given' ? absentIds : undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Error al guardar')
      setSaving(false)
      return
    }
    setSaving(false)
    setMode('idle')
    router.refresh()
  }

  if (existingSession?.confirmed_by_admin) {
    return (
      <Notice tone="success" icon={<CircleCheck />}>
        Confirmado por el admin: {existingSession.status === 'given' ? 'clase dada' : 'clase no dada'} el {sessionDateLabel}
      </Notice>
    )
  }

  if (existingSession && mode === 'idle') {
    return (
      <Notice
        tone="warn"
        icon={<Clock />}
        action={
          <Button variant="secondary" size="sm" onClick={() => setMode(existingSession.status)}>
            Corregir
          </Button>
        }
      >
        Marcada como {existingSession.status === 'given' ? 'dada' : 'no dada'} el {sessionDateLabel}. Pendiente de que el admin la confirme.
      </Notice>
    )
  }

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-heading text-ink">¿Se ha dado la clase del {sessionDateLabel.toLowerCase()}?</h3>
      <p className="mb-4 mt-0.5 text-meta text-ink-3">Queda pendiente de que el admin lo confirme.</p>

      {mode === 'idle' && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="sm:flex-1" onClick={() => setMode('given')}>
            Sí, se ha dado
          </Button>
          <Button variant="danger-ghost" size="lg" className="border border-danger-ink/30 sm:flex-1" onClick={() => setMode('not_given')}>
            No se ha dado
          </Button>
        </div>
      )}

      {mode === 'given' && (
        <div className="space-y-4">
          {students.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-label text-ink">Marca quién ha faltado (opcional)</legend>
              <div className="divide-y divide-line">
                {students.map((s) => (
                  <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-accent-ink"
                      checked={absentIds.includes(s.id)}
                      onChange={(e) => setAbsentIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id))}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setMode('idle')}>Cancelar</Button>
            <Button onClick={() => submit('given')} loading={saving}>
              {saving ? 'Guardando...' : 'Confirmar clase dada'}
            </Button>
          </div>
        </div>
      )}

      {mode === 'not_given' && (
        <div className="space-y-4">
          <Field label="Motivo (opcional)">
            <Input
              type="text"
              placeholder="Por ejemplo, pista ocupada"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setMode('idle')}>Cancelar</Button>
            <Button variant="danger" onClick={() => submit('not_given')} loading={saving}>
              {saving ? 'Guardando...' : 'Confirmar clase no dada'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
