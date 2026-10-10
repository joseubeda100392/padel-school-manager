'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MonthNavigator } from '../payments/month-navigator'
import { CircleAlert, CircleCheck, CircleX, ClipboardCheck, UserX, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { EmptyState, Notice } from '@/components/ui/feedback'
import { List, Stat } from '@/components/ui/list'
import { useConfirm } from '@/components/ui/confirm'

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

export function ClassValidationClient({
  initialPending,
  initialPayroll,
  selectedYear,
  selectedMonth,
  maxYear,
  maxMonth,
}: {
  initialPending: PendingSession[]
  initialPayroll: CoachPayroll[]
  selectedYear: number
  selectedMonth: number
  maxYear: number
  maxMonth: number
}) {
  const router = useRouter()
  const confirm = useConfirm()
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
    const ok = await confirm({
      title: '¿Marcar como pagado?',
      description: 'Las horas pendientes de este monitor pasarán a cero.',
      confirmLabel: 'Marcar pagado',
    })
    if (!ok) return
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
      <PageHeader
        title="Validación de clases"
        description="Confirma las sesiones marcadas por los monitores y gestiona su nómina."
      />

      {error && <Notice tone="danger" icon={<CircleAlert />}>{error}</Notice>}

      <Card className="overflow-hidden">
        <CardHeader title={`Pendientes de confirmar (${initialPending.length})`} />
        {initialPending.length === 0 ? (
          <EmptyState icon={<ClipboardCheck />} title="Todo confirmado" description="No hay sesiones pendientes de confirmar." />
        ) : (
          <List className="mt-3">
            {initialPending.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-label text-ink">
                    {formatDate(s.sessionDate)} · {s.coachName} · {s.courtName}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-meta">
                    {s.status === 'given' ? (
                      <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Marcada como dada</Badge>
                    ) : (
                      <Badge tone="danger"><CircleX className="h-3.5 w-3.5" aria-hidden />Marcada como no dada</Badge>
                    )}
                    {s.cancelReason && <span className="text-ink-3">{s.cancelReason}</span>}
                  </p>
                  {s.absences.length > 0 && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-meta text-warn-ink">
                      <UserX className="h-4 w-4 shrink-0" aria-hidden />
                      Ausentes: {s.absences.map((a) => a.studentName).join(', ')}
                    </p>
                  )}
                </div>
                <Button onClick={() => confirmSession(s.id)} loading={confirmingId === s.id} className="w-full sm:w-auto">
                  {confirmingId === s.id ? 'Confirmando sesión' : 'Confirmar sesión'}
                </Button>
              </li>
            ))}
          </List>
        )}
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Stat
              label={`Total del club en ${MONTH_NAMES[selectedMonth]}`}
              value={`${initialPayroll.reduce((acc, c) => acc + c.monthlyHours, 0).toFixed(1)} h`}
              hint={`${initialPayroll.reduce((acc, c) => acc + c.monthlySessionCount, 0)} clases entre ${initialPayroll.length} monitor${initialPayroll.length !== 1 ? 'es' : ''}`}
            />
            <MonthNavigator year={selectedYear} month={selectedMonth} basePath="/dashboard/class-validation" maxYear={maxYear} maxMonth={maxMonth} />
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Nómina de monitores" description="Horas pendientes desde el último pago, según sesiones confirmadas." />
        {initialPayroll.length === 0 ? (
          <EmptyState icon={<Users />} title="Sin monitores" description="No hay monitores activos en este club." />
        ) : (
          <List className="mt-3">
            {initialPayroll.map((c) => (
              <li key={c.id} className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-label text-ink">{c.name}</p>
                  <p className="text-meta tabular-nums text-ink-3">
                    {c.hours.toFixed(1)} h pendientes ({c.sessionCount} sesiones) {c.periodStart ? `desde ${formatDate(c.periodStart)}` : '(histórico completo)'}
                  </p>
                  <p className="text-meta tabular-nums text-ink-3">
                    {c.monthlyHours.toFixed(1)} h en {MONTH_NAMES[selectedMonth]} ({c.monthlySessionCount} sesiones)
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Tarifa por hora (€)" className="w-32">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder={c.hourlyRateCents ? (c.hourlyRateCents / 100).toString() : '0'}
                      value={rateEdits[c.id] ?? ''}
                      onChange={(e) => setRateEdits((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      className="tabular-nums"
                    />
                  </Field>
                  <Button
                    variant="secondary"
                    onClick={() => saveRate(c.id)}
                    loading={savingRateId === c.id}
                    disabled={rateEdits[c.id] === undefined}
                  >
                    Guardar tarifa
                  </Button>
                  <span className="min-h-11 content-center font-display text-heading tabular-nums text-ink">{euros(c.amountCents)}</span>
                  <Button
                    onClick={() => markCoachPaid(c.id)}
                    loading={payingId === c.id}
                    disabled={c.sessionCount === 0 || !c.hourlyRateCents}
                  >
                    Marcar pagado
                  </Button>
                </div>
              </li>
            ))}
          </List>
        )}
      </Card>
    </div>
  )
}
