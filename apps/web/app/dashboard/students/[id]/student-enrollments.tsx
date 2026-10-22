'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { currentBillingMonth } from '@/lib/billing-cycle'
import { halfFeeDiscountCents, restoreDiscountedPrice } from '@/lib/enrollment-discount'
import { CalendarX, Check, CircleCheck, Clock, Pencil, X } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/feedback'
import { List } from '@/components/ui/list'
import { useConfirm } from '@/components/ui/confirm'
import { StartDatePicker } from '@/components/start-date-picker'
import { dayBefore, madridToday } from '@/lib/enrollment-window'

interface Enrollment {
  id: string
  monthly_price: number
  paid_until: string | null
  start_date: string | null
  end_date: string | null
  discount_applied: boolean
  discount_cents: number | null
  schedule: { id: string; start_time: string; court: { name: string } | null } | null
}

interface AvailableGroup {
  id: string
  label: string
  full: boolean
}

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES')

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function isPaidThisMonth(paidUntil: string | null) {
  if (!paidUntil) return false
  const now = new Date()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return new Date(paidUntil) >= endOfMonth
}

export function StudentEnrollments({
  initialEnrollments,
  legacyDiscountCents,
  studentId,
  availableGroups,
}: {
  initialEnrollments: Enrollment[]
  legacyDiscountCents: number
  studentId: string
  availableGroups: AvailableGroup[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [enrollments, setEnrollments] = useState(initialEnrollments)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState('')
  const [movePrice, setMovePrice] = useState(0)
  const [moveDate, setMoveDate] = useState('')
  const [moving, setMoving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState(0)
  const [saving, setSaving] = useState(false)
  const [discountLoadingId, setDiscountLoadingId] = useState<string | null>(null)

  const currentMonth = MONTHS[currentBillingMonth().month0]

  async function saveEnrollment(id: string, updates: { monthly_price: number; discount_applied?: boolean; discount_cents?: number | null }): Promise<boolean> {
    try {
      const res = await fetch(`/api/group-enrollments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        toast.error('No se pudo guardar el cambio. Inténtalo de nuevo.')
        return false
      }
    } catch {
      toast.error('Error de conexión. El cambio no se ha guardado.')
      return false
    }
    setEnrollments((prev) =>
      prev.map((e) => e.id === id ? { ...e, ...updates } : e)
    )
    return true
  }

  async function handleSavePrice(id: string) {
    setSaving(true)
    const ok = await saveEnrollment(id, { monthly_price: editingPrice })
    if (ok) setEditingId(null)
    setSaving(false)
  }

  // El descuento es la mitad de la cuota de este alumno (no la del grupo), y
  // se guarda el importe descontado para devolver exactamente esos euros al
  // quitarlo.
  async function handleToggleDiscount(e: Enrollment) {
    setDiscountLoadingId(e.id)
    if (e.discount_applied) {
      const restoredPrice = restoreDiscountedPrice(e.monthly_price, e.discount_cents, legacyDiscountCents)
      const ok = await saveEnrollment(e.id, { monthly_price: restoredPrice, discount_applied: false, discount_cents: null })
      if (ok) toast.success(`Descuento quitado — cuota de ${formatCurrency(restoredPrice)}/mes`)
    } else {
      const discountCents = halfFeeDiscountCents(e.monthly_price)
      const discountedPrice = e.monthly_price - discountCents
      const ok = await saveEnrollment(e.id, { monthly_price: discountedPrice, discount_applied: true, discount_cents: discountCents })
      if (ok) toast.success(`Descuento del 50% aplicado — ${formatCurrency(discountedPrice)}/mes este mes`)
    }
    setDiscountLoadingId(null)
  }

  function openMove(e: Enrollment) {
    setMovingId(e.id)
    setMoveTarget('')
    setMovePrice(e.monthly_price)
    setMoveDate('')
  }

  // Cambio de grupo en un solo paso: el grupo nuevo hereda lo pagado, lo
  // pendiente y los descuentos del viejo, y el viejo se quita solo si el
  // nuevo se ha creado bien.
  async function handleMove(e: Enrollment) {
    const target = availableGroups.find(g => g.id === moveTarget)
    if (!target) return
    const priceChanged = movePrice !== e.monthly_price
    const scheduled = !!moveDate && moveDate > madridToday()
    const lines = [
      scheduled
        ? `Sigue en su grupo actual hasta el ${fmtDate(dayBefore(moveDate))} y desde el ${fmtDate(moveDate)} pasa al nuevo. No es una baja: no se le desactiva.`
        : 'Se le quita de su grupo actual y lo pagado o pendiente pasa al nuevo.',
      priceChanged ? `Cuota nueva: ${formatCurrency(movePrice)}/mes.` : '',
      priceChanged && e.discount_applied && !scheduled ? 'El descuento marcado no se mantiene al cambiar la cuota.' : '',
    ].filter(Boolean)
    const ok = await confirm({
      title: `¿Cambiar al grupo ${target.label}?`,
      description: lines.join(' '),
      confirmLabel: scheduled ? 'Programar cambio' : 'Cambiar de grupo',
      cancelLabel: 'Cancelar',
    })
    if (!ok) return
    setMoving(true)
    try {
      const res = await fetch('/api/group-enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: target.id, studentId, monthlyPrice: movePrice, replacesEnrollmentId: e.id, ...(scheduled ? { startDate: moveDate } : {}) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'No se pudo cambiar de grupo')
        return
      }
      toast.success(scheduled ? `Cambio programado: pasa al grupo nuevo el ${fmtDate(moveDate)}` : 'Cambio de grupo hecho')
      setMovingId(null)
      router.refresh()
    } catch {
      toast.error('Error de conexión. No se ha cambiado de grupo.')
    } finally {
      setMoving(false)
    }
  }

  if (!enrollments.length) {
    return (
      <Card>
        <CardHeader title="Clases y cuotas" />
        <EmptyState icon={<CalendarX />} title="Sin clases fijas" description="No está inscrito en ninguna clase de grupo fijo." />
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Clases y cuotas"
        description={`${enrollments.length} inscripción${enrollments.length !== 1 ? 'es' : ''} activa${enrollments.length !== 1 ? 's' : ''}`}
      />
      <List className="mt-3">
        {enrollments.map((e) => {
          const paid = isPaidThisMonth(e.paid_until)
          const startsLater = !!e.start_date && e.start_date > madridToday()
          const dow = e.schedule?.start_time ? new Date(e.schedule.start_time).getDay() : null
          const time = e.schedule?.start_time
            ? new Date(e.schedule.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
            : null
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-label text-ink">
                  {dow !== null ? `${DAYS[dow]} ${time}` : '—'} · {e.schedule?.court?.name ?? '—'}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-meta tabular-nums text-ink-3">
                  {e.start_date && <span>Alta: {fmtDate(e.start_date)}</span>}
                  {e.end_date && <span>Sale: {fmtDate(e.end_date)}</span>}
                </div>
              </div>

              {editingId === e.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    inputMode="decimal"
                    aria-label="Cuota mensual en euros"
                    onFocus={e => e.target.select()}
                    value={editingPrice === 0 ? '' : String(editingPrice / 100)}
                    onChange={(ev) => setEditingPrice(Math.round(Number(ev.target.value) * 100))}
                    className="w-24 tabular-nums"
                    autoFocus
                  />
                  <span className="text-meta text-ink-3">€/mes</span>
                  <Button size="icon" loading={saving} aria-label="Guardar cuota" onClick={() => handleSavePrice(e.id)}>
                    <Check className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Cancelar edición" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setEditingId(e.id); setEditingPrice(e.monthly_price) }}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-label tabular-nums text-ink hover:bg-ink/5"
                  aria-label={`Editar cuota, ahora ${formatCurrency(e.monthly_price)}`}
                >
                  {formatCurrency(e.monthly_price)}
                  <Pencil className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                </button>
              )}

              {e.schedule?.id && (
                <label
                  className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-label text-ink-2"
                  title="Descuento del 50% de la cuota. Solo vale para el próximo cobro y se desmarca solo al registrar el pago."
                >
                  <input
                    type="checkbox"
                    checked={e.discount_applied}
                    disabled={discountLoadingId === e.id}
                    onChange={() => handleToggleDiscount(e)}
                    className="h-5 w-5 rounded border-line-strong accent-accent-ink"
                  />
                  Descuento
                </label>
              )}

              {startsLater ? (
                <Badge tone="neutral"><Clock className="h-3.5 w-3.5" aria-hidden />Empieza el {fmtDate(e.start_date!)}</Badge>
              ) : paid ? (
                <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Al día</Badge>
              ) : (
                <Badge tone="warn"><Clock className="h-3.5 w-3.5" aria-hidden />Pendiente de {currentMonth}</Badge>
              )}

              {!e.end_date && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => (movingId === e.id ? setMovingId(null) : openMove(e))}
                >
                  Cambiar de grupo
                </Button>
              )}
              <Link
                href={`/dashboard/schedule/${e.schedule?.id}`}
                className={buttonVariants({ variant: 'link', size: 'sm', className: 'min-h-11 shrink-0' })}
              >
                Ver clase
              </Link>
              {movingId === e.id && (
                <div className="w-full basis-full rounded-card border border-line bg-surface-2 p-3">
                  <p className="mb-2 text-meta text-ink-2">
                    {moveDate
                      ? `Sigue en este grupo hasta el ${fmtDate(dayBefore(moveDate))}. Lo que haya pagado de después pasa al nuevo.`
                      : 'Lo pagado y lo pendiente de este grupo pasan al nuevo.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={moveTarget}
                      onChange={(ev) => setMoveTarget(ev.target.value)}
                      className="w-full sm:w-auto sm:min-w-[320px]"
                      aria-label="Grupo nuevo"
                    >
                      <option value="">Elige el grupo nuevo…</option>
                      {availableGroups
                        .filter(g => !enrollments.some(x => x.schedule?.id === g.id))
                        .map(g => (
                          <option key={g.id} value={g.id} disabled={g.full && !moveDate}>
                            {g.label}{g.full ? (moveDate ? ' (hoy completo)' : ' (completo)') : ''}
                          </option>
                        ))}
                    </Select>
                    <StartDatePicker value={moveDate} onChange={setMoveDate} todayLabel="Desde ya" />
                    <label className="flex items-center gap-1.5 text-meta text-ink-2">
                      <Input
                        type="text"
                        inputMode="decimal"
                        onFocus={ev => ev.target.select()}
                        value={movePrice === 0 ? '' : String(movePrice / 100)}
                        onChange={(ev) => setMovePrice(Math.round(Number(ev.target.value) * 100))}
                        className="w-24"
                        aria-label="Cuota en el grupo nuevo"
                      />
                      €/mes
                    </label>
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => handleMove(e)} disabled={!moveTarget || moving}>
                      {moving ? 'Guardando…' : moveDate ? 'Programar cambio' : 'Confirmar cambio'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setMovingId(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </List>
    </Card>
  )
}
