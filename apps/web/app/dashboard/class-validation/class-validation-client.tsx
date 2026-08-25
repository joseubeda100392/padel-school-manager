'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PendingSession {
  id: string
  scheduleId: string
  sessionDate: string
  status: 'given' | 'not_given'
  cancelReason: string | null
  markedAt: string
  coachName: string
  courtName: string
  startTime: string | null
  absences: { id: string; studentId: string; studentName: string }[]
}

interface CoachPayroll {
  id: string
  name: string
  email: string
  hours: number
  amountCents: number
  sessionCount: number
  periodStart: string | null
  hourlyRateCents: number | null
  monthlyHours: number
  monthlySessionCount: number
}

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}
function euros(cents: number) {
  return (cents / 100).toFixed(2) + ' €'
}

export function ClassValidationClient({ initialPending, initialPayroll }: { initialPending: PendingSession[]; initialPayroll: CoachPayroll[] }) {
  const router = useRouter()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [rateEdits, setRateEdits] = useState<Record<string, string>>({})
  const [savingRateId, setSavingRateId] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)

  async function confirmSession(id: string) {
    setConfirmingId(id)
    setError('')
    const res = await fetch(`/api/admin/class-sessions/${id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Error al confirmar')
      setConfirmingId(null)
      return
    }
    setConfirmingId(null)
    router.refresh()
  }

  async function saveRate(coachId: string) {
    const raw = rateEdits[coachId]
    if (raw === undefined) return
    const cents = Math.round(parseFloat(raw.replace(',', '.')) * 100)
    if (isNaN(cents) || cents < 0) return
    setSavingRateId(coachId)
    await fetch(`/api/admin/coach-payroll/${coachId}/rate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hourlyRateCents: cents }),
    })
    setSavingRateId(null)
    router.refresh()
  }

  async function markCoachPaid(coachId: string) {
    if (!confirm('¿Marcar como pagado? Las horas pendientes de este profesor pasarán a cero.')) return
    setPayingId(coachId)
    const res = await fetch(`/api/admin/coach-payroll/${coachId}/mark-paid`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setPayingId(null)
    if (!res.ok) {
      setError(json.error ?? 'Error al marcar como pagado')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Validación de clases</h1>
        <p className="text-sm text-gray-500">Confirma las sesiones marcadas por los profesores y gestiona su nómina.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Pendientes de confirmar <span className="ml-1 text-sm font-normal text-gray-400">({initialPending.length})</span></h2>
        </div>
        {initialPending.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">No hay sesiones pendientes de confirmar.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {initialPending.map((s) => (
              <div key={s.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(s.sessionDate)} — {s.coachName} — {s.courtName}
                  </p>
                  <p className="mt-0.5 text-xs">
                    <span className={s.status === 'given' ? 'text-green-600' : 'text-red-600'}>
                      {s.status === 'given' ? 'Marcada como dada' : 'Marcada como NO dada'}
                    </span>
                    {s.cancelReason && <span className="text-gray-400"> — {s.cancelReason}</span>}
                  </p>
                  {s.absences.length > 0 && (
                    <p className="mt-0.5 text-xs text-amber-600">
                      Ausentes: {s.absences.map((a) => a.studentName).join(', ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => confirmSession(s.id)}
                  disabled={confirmingId === s.id}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  {confirmingId === s.id ? 'Confirmando...' : 'Confirmar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border-l-4 border-l-brand-500 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">Total del club en {MONTH_NAMES[new Date().getMonth()]}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">
          {initialPayroll.reduce((acc, c) => acc + c.monthlyHours, 0).toFixed(1)}h
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          {initialPayroll.reduce((acc, c) => acc + c.monthlySessionCount, 0)} clases entre {initialPayroll.length} monitor{initialPayroll.length !== 1 ? 'es' : ''}
        </p>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Nómina de profesores</h2>
          <p className="mt-0.5 text-xs text-gray-400">Horas pendientes desde el último pago, según sesiones confirmadas.</p>
        </div>
        {initialPayroll.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">No hay profesores en este club.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {initialPayroll.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {c.hours.toFixed(1)}h pendientes ({c.sessionCount} sesiones) {c.periodStart ? `desde ${formatDate(c.periodStart)}` : '(histórico completo)'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {c.monthlyHours.toFixed(1)}h en {MONTH_NAMES[new Date().getMonth()]} ({c.monthlySessionCount} sesiones)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={c.hourlyRateCents ? (c.hourlyRateCents / 100).toString() : 'Tarifa/h'}
                      value={rateEdits[c.id] ?? ''}
                      onChange={(e) => setRateEdits((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 pr-6 text-xs focus:border-brand-500 focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-gray-400">€</span>
                  </div>
                  <button
                    onClick={() => saveRate(c.id)}
                    disabled={savingRateId === c.id || rateEdits[c.id] === undefined}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Guardar tarifa
                  </button>
                  <span className="text-sm font-semibold text-gray-900">{euros(c.amountCents)}</span>
                  <button
                    onClick={() => markCoachPaid(c.id)}
                    disabled={payingId === c.id || c.sessionCount === 0 || !c.hourlyRateCents}
                    className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-40"
                  >
                    {payingId === c.id ? '...' : 'Marcar pagado'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
