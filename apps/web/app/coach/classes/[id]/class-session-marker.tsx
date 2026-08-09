'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
        <p className="font-medium text-green-700">
          ✓ Confirmado por el admin — {existingSession.status === 'given' ? 'clase dada' : 'clase no dada'} el {sessionDateLabel}
        </p>
      </div>
    )
  }

  if (existingSession && mode === 'idle') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="font-medium text-amber-700">
          Marcado como {existingSession.status === 'given' ? 'dada' : 'no dada'} el {sessionDateLabel} — pendiente de confirmar por el admin
        </p>
        <button onClick={() => setMode(existingSession.status)} className="mt-2 text-xs font-medium text-amber-700 underline hover:text-amber-900">
          Corregir
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h3 className="mb-1 font-semibold text-gray-900">¿Se ha dado la clase del {sessionDateLabel}?</h3>
      <p className="mb-3 text-xs text-gray-400">Esto queda pendiente de que el admin lo confirme.</p>

      {mode === 'idle' && (
        <div className="flex gap-3">
          <button onClick={() => setMode('given')} className="flex-1 rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600">
            Sí, se ha dado
          </button>
          <button onClick={() => setMode('not_given')} className="flex-1 rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
            No se ha dado
          </button>
        </div>
      )}

      {mode === 'given' && (
        <div className="space-y-3">
          {students.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-600">Marca quién ha faltado (opcional):</p>
              <div className="space-y-1.5">
                {students.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={absentIds.includes(s.id)}
                      onChange={(e) => setAbsentIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id))}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setMode('idle')} className="flex-1 rounded-lg border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={() => submit('given')} disabled={saving} className="flex-1 rounded-lg bg-brand-500 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {saving ? 'Guardando...' : 'Confirmar clase dada'}
            </button>
          </div>
        </div>
      )}

      {mode === 'not_given' && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Motivo (opcional, ej. pista ocupada)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setMode('idle')} className="flex-1 rounded-lg border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={() => submit('not_given')} disabled={saving} className="flex-1 rounded-lg bg-red-500 py-2 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-60">
              {saving ? 'Guardando...' : 'Confirmar no dada'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
