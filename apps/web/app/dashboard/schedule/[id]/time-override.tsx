'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    if (!confirm('¿Quitar el cambio de hora y volver al horario habitual ese día?')) return
    setSaving(true)
    await fetch(`/api/admin/schedules/${scheduleId}/time-override?date=${nextDate}`, { method: 'DELETE' })
    setSaving(false)
    router.refresh()
  }

  if (existingOverride && !showForm) {
    return (
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        <p className="font-medium text-amber-800">
          ⚠️ Cambio de hora puntual: el {nextDateLabel} es a las {toHHMM(existingOverride.new_start_time)} (en vez de la hora habitual)
        </p>
        {existingOverride.reason && <p className="mt-0.5 text-xs text-amber-600">{existingOverride.reason}</p>}
        <div className="mt-2 flex gap-3">
          <button onClick={() => setShowForm(true)} className="text-xs font-medium text-amber-700 underline hover:text-amber-900">Editar</button>
          <button onClick={handleRemove} disabled={saving} className="text-xs font-medium text-red-600 underline hover:text-red-800">Quitar cambio</button>
        </div>
      </div>
    )
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="mt-3 text-xs font-medium text-gray-500 underline hover:text-gray-700"
      >
        Cambiar la hora solo el {nextDateLabel} (pista no disponible, etc.)
      </button>
    )
  }

  return (
    <form onSubmit={handleSave} className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-600">Nueva hora solo para el {nextDateLabel}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Hora inicio</label>
          <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Hora fin</label>
          <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
      </div>
      <input
        type="text"
        placeholder="Motivo (opcional, ej. pista ocupada)"
        value={reason}
        onChange={e => setReason(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-brand-500 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-60">
          {saving ? 'Guardando...' : 'Guardar y avisar al grupo'}
        </button>
      </div>
    </form>
  )
}
