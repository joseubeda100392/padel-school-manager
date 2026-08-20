'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    if (!confirm('¿Quitar el sustituto y que la clase vuelva a contar para el monitor habitual?')) return
    setSaving(true)
    await fetch(`/api/admin/schedules/${scheduleId}/coach-override?date=${nextDate}`, { method: 'DELETE' })
    setSaving(false)
    router.refresh()
  }

  if (existingOverride && !showForm) {
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        <p className="font-medium text-amber-800">
          ⚠️ Sustituto puntual: el {nextDateLabel} la da {existingCoachName ?? 'otro monitor'} (en vez del habitual)
        </p>
        {existingOverride.reason && <p className="mt-0.5 text-xs text-amber-600">{existingOverride.reason}</p>}
        <div className="mt-2 flex gap-3">
          <button onClick={() => setShowForm(true)} className="text-xs font-medium text-amber-700 underline hover:text-amber-900">Editar</button>
          <button onClick={handleRemove} disabled={saving} className="text-xs font-medium text-red-600 underline hover:text-red-800">Quitar sustituto</button>
        </div>
      </div>
    )
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="mt-2 block text-xs font-medium text-gray-500 underline hover:text-gray-700"
      >
        Poner un sustituto solo el {nextDateLabel} (el titular no puede)
      </button>
    )
  }

  return (
    <form onSubmit={handleSave} className="mt-2 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-600">Sustituto solo para el {nextDateLabel}</p>
      <select
        required
        value={coachId}
        onChange={(e) => setCoachId(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      >
        <option value="">Selecciona un monitor…</option>
        {substituteOptions.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Motivo (opcional, ej. baja médica)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={saving || !coachId} className="flex-1 rounded-lg bg-brand-500 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          {saving ? 'Guardando...' : 'Guardar sustituto'}
        </button>
      </div>
    </form>
  )
}
