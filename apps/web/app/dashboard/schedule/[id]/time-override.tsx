'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { useConfirm } from '@/components/ui/confirm'

interface Override {
  id: string
  override_date: string
  new_start_time: string
  new_end_time: string
  reason: string | null
}

function toHHMM(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(new Date(iso))
}

export function TimeOverride({ scheduleId, nextDate, nextDateLabel, existingOverride }: {
  scheduleId: string
  nextDate: string
  nextDateLabel: string
  existingOverride: Override | null
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [startTime, setStartTime] = useState(existingOverride ? toHHMM(existingOverride.new_start_time) : '')
  const [endTime, setEndTime] = useState(existingOverride ? toHHMM(existingOverride.new_end_time) : '')
  const [reason, setReason] = useState(existingOverride?.reason ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/schedules/${scheduleId}/time-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrideDate: nextDate, newStartTime: startTime, newEndTime: endTime, reason: reason || undefined }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Error al guardar')
      setSaving(false)
      return
    }
    setShowForm(false)
    setSaving(false)
    router.refresh()
  }

  async function handleRemove() {
    if (!(await confirm({
      title: '¿Quitar el cambio de hora?',
      description: 'La clase volverá al horario habitual ese día.',
      confirmLabel: 'Quitar cambio',
      destructive: true,
    }))) return
    setSaving(true)
    await fetch(`/api/admin/schedules/${scheduleId}/time-override?date=${nextDate}`, { method: 'DELETE' })
    setSaving(false)
    router.refresh()
  }

  if (existingOverride && !showForm) {
    return (
      <Notice tone="warn" icon={<TriangleAlert />} className="mt-4">
        <p className="font-medium">
          Cambio de hora puntual: el {nextDateLabel} es a las {toHHMM(existingOverride.new_start_time)} en vez de la hora habitual.
        </p>
        {existingOverride.reason && <p className="mt-0.5 text-meta">{existingOverride.reason}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>Editar</Button>
          <Button variant="danger-ghost" size="sm" onClick={handleRemove} disabled={saving}>Quitar cambio</Button>
        </div>
      </Notice>
    )
  }

  if (!showForm) {
    return (
      <div className="mt-4">
        <Button variant="link" onClick={() => setShowForm(true)} className="h-auto whitespace-normal text-left text-meta">
          Cambiar la hora solo el {nextDateLabel} (pista no disponible, etc.)
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="mt-4 space-y-3 rounded-control border border-line bg-surface-2 p-4">
      <p className="text-label text-ink">Nueva hora solo para el {nextDateLabel}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Hora de inicio">
          <Input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} />
        </Field>
        <Field label="Hora de fin">
          <Input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Motivo (opcional)">
        <Input type="text" placeholder="Por ejemplo, pista ocupada" value={reason} onChange={e => setReason(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
        <Button type="submit" loading={saving}>{saving ? 'Guardando…' : 'Guardar y avisar al grupo'}</Button>
      </div>
    </form>
  )
}
