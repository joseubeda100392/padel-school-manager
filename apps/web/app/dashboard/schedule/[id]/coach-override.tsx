'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { useConfirm } from '@/components/ui/confirm'

interface Coach {
  id: string
  name: string
  email: string
}

interface Override {
  id: string
  override_date: string
  new_coach_id: string
  reason: string | null
  // PostgREST puede devolver el embed como objeto o como array de 1 según
  // cómo infiera la cardinalidad de la FK — se normaliza al usarlo.
  coach: { name: string } | { name: string }[] | null
}

export function CoachOverride({ scheduleId, nextDate, nextDateLabel, coaches, existingOverride, regularCoachId }: {
  scheduleId: string
  nextDate: string
  nextDateLabel: string
  coaches: Coach[]
  existingOverride: Override | null
  regularCoachId: string | null
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [showForm, setShowForm] = useState(false)
  const [coachId, setCoachId] = useState(existingOverride?.new_coach_id ?? '')
  const [reason, setReason] = useState(existingOverride?.reason ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const substituteOptions = coaches.filter((c) => c.id !== regularCoachId)
  const existingCoachName = Array.isArray(existingOverride?.coach)
    ? existingOverride?.coach[0]?.name
    : existingOverride?.coach?.name

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!coachId) return
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/schedules/${scheduleId}/coach-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrideDate: nextDate, newCoachId: coachId, reason: reason || undefined }),
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
      title: '¿Quitar el sustituto?',
      description: 'La clase volverá a contar para el monitor habitual.',
      confirmLabel: 'Quitar sustituto',
      destructive: true,
    }))) return
    setSaving(true)
    await fetch(`/api/admin/schedules/${scheduleId}/coach-override?date=${nextDate}`, { method: 'DELETE' })
    setSaving(false)
    router.refresh()
  }

  if (existingOverride && !showForm) {
    return (
      <Notice tone="warn" icon={<TriangleAlert />} className="mt-3">
        <p className="font-medium">
          Sustituto puntual: el {nextDateLabel} la da {existingCoachName ?? 'otro monitor'} en vez del habitual.
        </p>
        {existingOverride.reason && <p className="mt-0.5 text-meta">{existingOverride.reason}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>Editar</Button>
          <Button variant="danger-ghost" size="sm" onClick={handleRemove} disabled={saving}>Quitar sustituto</Button>
        </div>
      </Notice>
    )
  }

  if (!showForm) {
    return (
      <div className="mt-2">
        <Button variant="link" onClick={() => setShowForm(true)} className="h-auto whitespace-normal text-left text-meta">
          Poner un sustituto solo el {nextDateLabel} (el titular no puede)
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="mt-3 space-y-3 rounded-control border border-line bg-surface-2 p-4">
      <p className="text-label text-ink">Sustituto solo para el {nextDateLabel}</p>
      <Field label="Monitor sustituto">
        <Select required value={coachId} onChange={(e) => setCoachId(e.target.value)}>
          <option value="">Selecciona un monitor</option>
          {substituteOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Motivo (opcional)">
        <Input type="text" placeholder="Por ejemplo, baja médica" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
        <Button type="submit" loading={saving} disabled={!coachId}>{saving ? 'Guardando…' : 'Guardar sustituto'}</Button>
      </div>
    </form>
  )
}
