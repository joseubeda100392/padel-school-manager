'use client'

import { toast } from 'sonner'
import { Banknote, CalendarPlus, CalendarX, Check, CircleAlert, CircleCheck, Clock, CreditCard, Eye, EyeOff, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Field, Input, Select } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { Avatar } from '@/components/ui/list'
import { useConfirm } from '@/components/ui/confirm'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StudentCombobox } from '@/components/student-combobox'
import { getDayOfWeek } from '@/lib/utils'
import type { InClubMethod } from '@/lib/payment-method'

interface Enrollment {
  id: string
  monthly_price: number
  price_per_class_cents?: number | null
  court_pricing?: 'con_pista' | 'sin_pista' | null
  discount_classes_pending?: number
  paid_until: string | null
  status: string
  start_date?: string | null
  end_date?: string | null
  student: { id: string; name: string; email: string }
}

interface CourtPricing {
  withCourt60: number
  withCourt90: number
  withoutCourt60: number
  withoutCourt90: number
}

interface OtherTariffs {
  claseSuelta60: number
  claseSuelta90: number
  claseEntera60: number
  claseEntera90: number
}

type TariffChoice = 'clase_suelta' | 'clase_entera' | 'con_pista' | 'sin_pista'

const TARIFF_LABELS: Record<TariffChoice, string> = {
  clase_suelta: 'Clase suelta',
  clase_entera: 'Clase entera',
  con_pista: 'Con pista',
  sin_pista: 'Sin pista',
}

interface Student {
  id: string
  name: string
  email: string
}

interface Exclusion {
  id: string
  excluded_date: string
  publish_spot: boolean
}

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DAYS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']

function isPaidThisMonth(paidUntil: string | null) {
  if (!paidUntil) return false
  const now = new Date()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return new Date(paidUntil) >= endOfMonth
}

// Próxima fecha de la clase para proponer en "Registrar falta", saltando los
// festivos del club (ese día no hay clase y el servidor rechaza la falta).
function getNextOccurrence(startTime: string, holidays: string[]): string {
  const base = new Date(startTime)
  const now = new Date()
  const next = new Date(now)
  next.setHours(base.getHours(), base.getMinutes(), 0, 0)
  const classDow = base.getDay()
  const todayDow = now.getDay()
  let daysAhead = (classDow - todayDow + 7) % 7
  if (daysAhead === 0 && next <= now) daysAhead = 7
  next.setDate(next.getDate() + daysAhead)
  while (next < base) next.setDate(next.getDate() + 7)
  for (let i = 0; i < 52 && holidays.includes(next.toISOString().split('T')[0]); i++) next.setDate(next.getDate() + 7)
  return next.toISOString().split('T')[0]
}

export default function GroupEnrollment({
  scheduleId,
  scheduleStartTime,
  scheduleEndTime,
  courtPricing,
  otherTariffs,
  initialEnrollments,
  initialExclusions,
  availableStudents,
  defaultMonthlyPrice,
  enablePayments = true,
  enableSpots = true,
  enableClassValidation = false,
  holidays = [],
}: {
  scheduleId: string
  scheduleStartTime: string
  scheduleEndTime?: string
  courtPricing?: CourtPricing
  otherTariffs?: OtherTariffs
  initialEnrollments: Enrollment[]
  initialExclusions: Record<string, Exclusion[]>
  availableStudents: Student[]
  defaultMonthlyPrice: number
  enablePayments?: boolean
  enableSpots?: boolean
  enableClassValidation?: boolean
  holidays?: string[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [enrollments, setEnrollments] = useState(initialEnrollments)
  const [exclusions, setExclusions] = useState<Record<string, Exclusion[]>>(initialExclusions)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [monthlyPrice, setMonthlyPrice] = useState(defaultMonthlyPrice)
  const [selectedTariff, setSelectedTariff] = useState<TariffChoice | ''>('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [markPaidError, setMarkPaidError] = useState<string | null>(null)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState(0)
  const [editingPerClassId, setEditingPerClassId] = useState<string | null>(null)
  const [editingPerClassValue, setEditingPerClassValue] = useState(0)
  const [faltaFormId, setFaltaFormId] = useState<string | null>(null)
  const [faltaDate, setFaltaDate] = useState('')
  const [faltaPublish, setFaltaPublish] = useState(true)
  const [faltaLoading, setFaltaLoading] = useState(false)
  const [faltaSuccessMsg, setFaltaSuccessMsg] = useState<string | null>(null)

  const now = new Date()
  const nextOccurrence = getNextOccurrence(scheduleStartTime, holidays)

  // Duración real de la clase, para saber qué tarifa (60/90 min) de
  // Con pista / Sin pista aplica — el admin no la elige, se deriva sola.
  const is90MinClass = scheduleEndTime
    ? (new Date(scheduleEndTime).getTime() - new Date(scheduleStartTime).getTime()) / 60000 >= 80
    : false

  function courtPricingCents(pricing: 'con_pista' | 'sin_pista'): number {
    if (!courtPricing) return 0
    if (pricing === 'con_pista') return is90MinClass ? courtPricing.withCourt90 : courtPricing.withCourt60
    return is90MinClass ? courtPricing.withoutCourt90 : courtPricing.withoutCourt60
  }

  function tariffPricePerClass(tariff: TariffChoice): number {
    if (tariff === 'con_pista' || tariff === 'sin_pista') return courtPricingCents(tariff)
    if (!otherTariffs) return 0
    if (tariff === 'clase_suelta') return is90MinClass ? otherTariffs.claseSuelta90 : otherTariffs.claseSuelta60
    return is90MinClass ? otherTariffs.claseEntera90 : otherTariffs.claseEntera60
  }

  function countOccurrences(dow: number, year: number, month0: number, fromDay: number): number {
    const daysInMonth = new Date(year, month0 + 1, 0).getDate()
    let count = 0
    for (let d = fromDay; d <= daysInMonth; d++) {
      if (getDayOfWeek(new Date(year, month0, d, 12)) === dow) count++
    }
    return count
  }

  // Cuántas veces queda esta clase (mismo día de la semana) desde HOY hasta
  // fin de mes — no el mes completo, que ya podría estar prácticamente
  // acabado (ej. si el día de la semana de la clase ya no vuelve a caer
  // este mes, se pasa directamente a contar el mes siguiente completo).
  // usesPerClassPricing=true (con/sin pista, clase suelta): el precio ya está
  // prorrateado por ocurrencia, así que una sola sesión que quede este mes es
  // facturable este mes. usesPerClassPricing=false (cuota plana, el caso
  // normal/heredado): no tiene sentido cobrar el mes entero por un solo día
  // suelto a final de mes — se usa el mismo umbral de días que en
  // lib/billing-cycle.ts (firstBillableMonth) para que esta etiqueta
  // coincida con lo que get_pending_payments() considera real.
  function billingTarget(usesPerClassPricing = true): { count: number; monthName: string; year: number; monthLabel: string } {
    const todayMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
    const [ty, tm, td] = todayMadrid.split('-').map(Number)
    const thisMonth0 = tm - 1

    if (!usesPerClassPricing) {
      const daysInMonth = new Date(ty, thisMonth0 + 1, 0).getDate()
      const daysRemaining = daysInMonth - td
      const DAYS_THRESHOLD = 5
      if (daysRemaining >= DAYS_THRESHOLD) {
        return { count: 0, monthName: MONTH_NAMES[thisMonth0], year: ty, monthLabel: `${MONTH_NAMES[thisMonth0]} ${ty}` }
      }
      const next = new Date(ty, thisMonth0 + 1, 1)
      return { count: 0, monthName: MONTH_NAMES[next.getMonth()], year: next.getFullYear(), monthLabel: `${MONTH_NAMES[next.getMonth()]} ${next.getFullYear()}` }
    }

    const dow = getDayOfWeek(scheduleStartTime)
    const remaining = countOccurrences(dow, ty, thisMonth0, td)
    if (remaining > 0) {
      return { count: remaining, monthName: MONTH_NAMES[thisMonth0], year: ty, monthLabel: `${MONTH_NAMES[thisMonth0]} ${ty}` }
    }
    const next = new Date(ty, thisMonth0 + 1, 1)
    const nextCount = countOccurrences(dow, next.getFullYear(), next.getMonth(), 1)
    return { count: nextCount, monthName: MONTH_NAMES[next.getMonth()], year: next.getFullYear(), monthLabel: `${MONTH_NAMES[next.getMonth()]} ${next.getFullYear()}` }
  }

  const enrolledIds = new Set(enrollments.map((e) => e.student.id))
  const unenrolledStudents = availableStudents.filter((s) => !enrolledIds.has(s.id))

  function handleSelectTariff(tariff: TariffChoice) {
    setSelectedTariff(tariff)
    const pricePerClass = tariffPricePerClass(tariff)
    setMonthlyPrice(pricePerClass * billingTarget().count)
  }

  async function handleAdd() {
    if (!selectedStudentId) return
    setAdding(true)
    setAddError('')
    const isCourtTariff = selectedTariff === 'con_pista' || selectedTariff === 'sin_pista'
    const res = await fetch('/api/group-enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleId,
        studentId: selectedStudentId,
        monthlyPrice,
        pricePerClassCents: selectedTariff ? tariffPricePerClass(selectedTariff) : null,
        courtPricing: isCourtTariff ? selectedTariff : null,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      const student = availableStudents.find((s) => s.id === selectedStudentId)!
      setEnrollments((prev) => [...prev, { ...json.data, student }])
      setSelectedStudentId('')
      setSelectedTariff('')
      router.refresh()
    } else {
      setAddError(json.error ?? 'No se pudo añadir al alumno')
    }
    setAdding(false)
  }

  async function handleRemove(id: string) {
    if (!(await confirm({
      title: '¿Quitar al alumno del grupo fijo?',
      description: 'Dejará de tener plaza permanente en esta clase.',
      confirmLabel: 'Quitar del grupo',
      destructive: true,
    }))) return
    setLoadingId(id)
    const res = await fetch(`/api/group-enrollments/${id}`, { method: 'DELETE' })
    setLoadingId(null)
    if (!res.ok) {
      toast.error('No se pudo quitar al alumno')
      return
    }
    setEnrollments((prev) => prev.filter((e) => e.id !== id))
    toast.success('Alumno dado de baja del grupo')
    router.refresh()
  }

  async function handleUpdatePrice(id: string) {
    setLoadingId(id)
    const res = await fetch(`/api/group-enrollments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthly_price: editingPriceValue }),
    })
    setLoadingId(null)
    if (!res.ok) {
      toast.error('No se pudo actualizar la cuota')
      return
    }
    setEnrollments((prev) =>
      prev.map((e) => e.id === id ? { ...e, monthly_price: editingPriceValue } : e)
    )
    setEditingPriceId(null)
  }

  async function handleUpdatePerClassPrice(id: string) {
    setLoadingId(id)
    const res = await fetch(`/api/group-enrollments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_per_class_cents: editingPerClassValue }),
    })
    setLoadingId(null)
    if (!res.ok) {
      toast.error('No se pudo actualizar el precio por clase')
      return
    }
    setEnrollments((prev) =>
      prev.map((e) => e.id === id ? { ...e, price_per_class_cents: editingPerClassValue } : e)
    )
    setEditingPerClassId(null)
  }

  async function handleMarkPaid(id: string, method: InClubMethod) {
    const how = method === 'card_terminal' ? 'con datáfono' : 'en efectivo'
    if (!(await confirm({
      title: `¿Registrar el pago ${how}?`,
      description: 'Se marcará este mes como pagado y quedará en el historial de pagos.',
      confirmLabel: 'Registrar pago',
    }))) return
    setLoadingId(id)
    setMarkPaidError(null)
    const res = await fetch(`/api/group-enrollments/${id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method }),
    })
    const json = await res.json()
    if (res.ok) {
      setEnrollments((prev) =>
        prev.map((e) => e.id === id ? { ...e, paid_until: json.paidUntil } : e)
      )
    } else {
      setMarkPaidError(json.error ?? 'Error al registrar el pago')
    }
    setLoadingId(null)
  }

  function openFaltaForm(enrollmentId: string) {
    setFaltaFormId(enrollmentId)
    setFaltaDate(nextOccurrence)
    setFaltaPublish(true)
  }

  async function handleRegistrarFalta(enrollmentId: string) {
    setFaltaLoading(true)
    const res = await fetch('/api/schedule-exclusions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_enrollment_id: enrollmentId,
        excluded_date: faltaDate,
        publish_spot: faltaPublish,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setExclusions((prev) => ({
        ...prev,
        [enrollmentId]: [...(prev[enrollmentId] ?? []), {
          id: json.data.id,
          excluded_date: faltaDate,
          publish_spot: faltaPublish,
        }],
      }))
      setFaltaFormId(null)
      if (json.newBagBalance != null) {
        const studentName = enrollments.find(e => e.id === enrollmentId)?.student.name ?? 'el alumno'
        setFaltaSuccessMsg(`+1 clase añadida a la bolsa de ${studentName} · Saldo actual: ${json.newBagBalance} clase${json.newBagBalance !== 1 ? 's' : ''}`)
        setTimeout(() => setFaltaSuccessMsg(null), 5000)
      }
      router.refresh()
    } else {
      toast.error(json.error ?? 'No se pudo registrar la falta')
    }
    setFaltaLoading(false)
  }

  async function handleDeleteExclusion(enrollmentId: string, exclusionId: string) {
    const res = await fetch('/api/schedule-exclusions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: exclusionId }),
    })
    if (!res.ok) {
      toast.error('No se pudo eliminar la falta')
      return
    }
    setExclusions((prev) => ({
      ...prev,
      [enrollmentId]: (prev[enrollmentId] ?? []).filter((x) => x.id !== exclusionId),
    }))
  }

  async function handleTogglePublish(enrollmentId: string, exclusion: Exclusion) {
    const res = await fetch('/api/schedule-exclusions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: exclusion.id, publish_spot: !exclusion.publish_spot }),
    })
    if (!res.ok) {
      toast.error('No se pudo actualizar el hueco')
      return
    }
    setExclusions((prev) => ({
      ...prev,
      [enrollmentId]: (prev[enrollmentId] ?? []).map((x) =>
        x.id === exclusion.id ? { ...x, publish_spot: !x.publish_spot } : x
      ),
    }))
  }

  return (
    <Card>
      <CardHeader
        title="Grupo fijo"
        description={`Alumnos con plaza permanente${enablePayments ? ` · Cuota de ${billingTarget(false).monthLabel}` : ''}`}
      />

      {markPaidError && (
        <p role="alert" className="mx-4 mt-3 text-meta font-medium text-danger-ink sm:mx-5">{markPaidError}</p>
      )}

      {faltaSuccessMsg && (
        <Notice tone="success" icon={<CircleCheck />} className="mx-4 mt-3 sm:mx-5">
          {faltaSuccessMsg}
        </Notice>
      )}

      {enrollments.length === 0 ? (
        <p className="px-4 py-6 text-body text-ink-3 sm:px-5">Aún no hay alumnos en el grupo fijo. Añade el primero abajo.</p>
      ) : (
        <div className="mt-3 divide-y divide-line border-t border-line">
          {enrollments.map((e) => {
            const paid = isPaidThisMonth(e.paid_until)
            const isLoading = loadingId === e.id
            // El servidor ya limita las faltas al rango relevante (desde la
            // fecha que se está viendo, o desde hoy si se ve el futuro) — no
            // volver a filtrar aquí por "hoy real", o una falta del día que
            // se está consultando (si ya pasó) desaparecería de la vista.
            const myExclusions = exclusions[e.id] ?? []
            const showFaltaForm = faltaFormId === e.id
            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
            const isPendingBaja = !!e.end_date
            const isPendingAlta = !!e.start_date && e.start_date > todayStr

            return (
              <div key={e.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Avatar name={e.student.name} />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-[0.9375rem] font-medium text-ink">{e.student.name}</p>
                    <p className="truncate text-meta text-ink-3">{e.student.email}</p>
                    {(isPendingBaja || isPendingAlta) && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {isPendingBaja && (
                          <Badge tone="danger">
                            <CalendarX className="h-3.5 w-3.5" aria-hidden />
                            Baja programada: {new Date(e.end_date + 'T12:00:00').toLocaleDateString('es-ES')}
                          </Badge>
                        )}
                        {isPendingAlta && (
                          <Badge tone="neutral">
                            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                            Sustituto: entra el {new Date(e.start_date + 'T12:00:00').toLocaleDateString('es-ES')}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {enablePayments && (editingPriceId === e.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          inputMode="decimal"
                          aria-label="Cuota mensual en euros"
                          onFocus={e => e.target.select()}
                          value={editingPriceValue === 0 ? '' : String(editingPriceValue / 100)}
                          onChange={(ev) => setEditingPriceValue(Math.round(Number(ev.target.value) * 100))}
                          className="w-24 tabular-nums"
                          autoFocus
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleUpdatePrice(e.id)} aria-label="Guardar cuota">
                          <Check className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditingPriceId(null)} aria-label="Cancelar edición de la cuota">
                          <X className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditingPriceId(e.id); setEditingPriceValue(e.monthly_price) }}
                        title="Editar cuota"
                        aria-label={`Editar cuota: ${(e.monthly_price / 100).toFixed(2)} euros al mes`}
                      >
                        <span className="tabular-nums">{(e.monthly_price / 100).toFixed(2)} €/mes</span>
                        <Pencil className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                      </Button>
                    ))}

                    {enableClassValidation && enablePayments && (editingPerClassId === e.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          inputMode="decimal"
                          aria-label="Precio por clase en euros"
                          onFocus={ev => ev.target.select()}
                          value={editingPerClassValue === 0 ? '' : String(editingPerClassValue / 100)}
                          onChange={(ev) => setEditingPerClassValue(Math.round(Number(ev.target.value) * 100))}
                          className="w-24 tabular-nums"
                          autoFocus
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleUpdatePerClassPrice(e.id)} aria-label="Guardar precio por clase">
                          <Check className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditingPerClassId(null)} aria-label="Cancelar edición del precio por clase">
                          <X className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditingPerClassId(e.id); setEditingPerClassValue(e.price_per_class_cents ?? 0) }}
                        title="Precio por clase suelta (para el descuento de clases no dadas)"
                      >
                        <span className="tabular-nums">{e.price_per_class_cents ? `${(e.price_per_class_cents / 100).toFixed(2)} €/clase` : 'Sin precio por clase'}</span>
                        <Pencil className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                      </Button>
                    ))}

                    {enableClassValidation && (e.discount_classes_pending ?? 0) > 0 && (
                      <Badge tone="warn">
                        <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                        −{e.discount_classes_pending} clase{e.discount_classes_pending === 1 ? '' : 's'} en el próximo cobro
                      </Badge>
                    )}

                    {enablePayments && (
                      paid ? (
                        <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Pagado</Badge>
                      ) : (
                        <Badge tone="warn"><Clock className="h-3.5 w-3.5" aria-hidden />Pendiente {billingTarget(!!(e.court_pricing || e.price_per_class_cents)).monthName}</Badge>
                      )
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {enablePayments && !paid && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => handleMarkPaid(e.id, 'cash')} loading={isLoading}>
                        <Banknote className="h-4 w-4" aria-hidden />
                        Efectivo
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleMarkPaid(e.id, 'card_terminal')} loading={isLoading}>
                        <CreditCard className="h-4 w-4" aria-hidden />
                        Datáfono
                      </Button>
                    </>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    aria-expanded={showFaltaForm}
                    onClick={() => showFaltaForm ? setFaltaFormId(null) : openFaltaForm(e.id)}
                    disabled={isLoading}
                  >
                    Registrar falta
                  </Button>

                  <Button variant="danger-ghost" size="sm" onClick={() => handleRemove(e.id)} loading={isLoading}>
                    Quitar del grupo
                  </Button>
                </div>

                {showFaltaForm && (
                  <div className="mt-3 rounded-control border border-line bg-surface-2 p-4">
                    <p className="mb-3 text-label text-ink">Registrar falta de {e.student.name}</p>
                    <div className="flex flex-wrap items-end gap-3">
                      <Field label="Fecha de la clase" className="w-full sm:w-48">
                        <Input
                          type="date"
                          value={faltaDate}
                          min={now.toISOString().split('T')[0]}
                          onChange={(ev) => setFaltaDate(ev.target.value)}
                        />
                      </Field>
                      {enableSpots && (
                        <div className="flex min-h-11 items-center gap-2">
                          <span id={`publicar-${e.id}`} className="text-label text-ink">Publicar plaza libre</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={faltaPublish}
                            aria-labelledby={`publicar-${e.id}`}
                            onClick={() => setFaltaPublish(!faltaPublish)}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${faltaPublish ? 'bg-accent-ink' : 'bg-line-strong'}`}
                          >
                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-card transition-transform ${faltaPublish ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                          <span className="text-meta text-ink-3">{faltaPublish ? 'Sí' : 'No'}</span>
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-meta text-ink-3">
                      {faltaPublish
                        ? 'El alumno recibe +1 clase disponible y la plaza se publica en la app.'
                        : 'El alumno recibe +1 clase disponible. La plaza no se publica.'}
                    </p>
                    <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button variant="secondary" onClick={() => setFaltaFormId(null)}>Cancelar</Button>
                      <Button onClick={() => handleRegistrarFalta(e.id)} disabled={!faltaDate} loading={faltaLoading}>
                        Confirmar falta
                      </Button>
                    </div>
                  </div>
                )}

                {myExclusions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {myExclusions.map((x) => (
                      <div key={x.id} className="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-3 pr-1">
                        <span className="text-meta text-ink-2">
                          Falta {new Date(x.excluded_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleTogglePublish(e.id, x)}
                          aria-pressed={x.publish_spot}
                          className={`inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-meta font-medium hover:bg-ink/5 ${x.publish_spot ? 'text-accent-ink' : 'text-ink-3'}`}
                          title={x.publish_spot ? 'Plaza publicada. Pulsa para ocultarla' : 'Plaza no publicada. Pulsa para publicarla'}
                        >
                          {x.publish_spot ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
                          {x.publish_spot ? 'Publicada' : 'No publicada'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExclusion(e.id, x.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-danger-ink hover:bg-danger-soft"
                          aria-label="Eliminar falta"
                          title="Eliminar falta"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="border-t border-line px-4 py-4 sm:px-5">
        <p className="mb-3 text-label text-ink">Añadir alumno al grupo fijo</p>
        {addError && (
          <p role="alert" className="mb-2 text-meta font-medium text-danger-ink">{addError}</p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <StudentCombobox
            students={unenrolledStudents}
            value={selectedStudentId}
            onChange={setSelectedStudentId}
            placeholder="Buscar alumno por nombre o email"
          />
          {enablePayments && enableClassValidation && (courtPricing || otherTariffs) && (
            <Select
              aria-label="Tarifa"
              value={selectedTariff}
              onChange={(e) => handleSelectTariff(e.target.value as TariffChoice)}
              className="w-full sm:w-auto"
            >
              <option value="" disabled>Elige una tarifa</option>
              {(['clase_suelta', 'con_pista', 'sin_pista'] as TariffChoice[]).map((tariff) => (
                <option key={tariff} value={tariff}>
                  {TARIFF_LABELS[tariff]} ({(tariffPricePerClass(tariff) / 100).toFixed(2)} €/clase)
                </option>
              ))}
            </Select>
          )}
          {selectedTariff && (
            <span className="flex min-h-11 items-center text-meta text-ink-3">
              Cuota de {billingTarget().monthLabel}
            </span>
          )}
          {enablePayments && (
            <Field label="Precio al mes (€)" className="w-full sm:w-32">
              <Input
                type="text"
                inputMode="numeric"
                onFocus={e => e.target.select()}
                min={0}
                step={0.5}
                value={monthlyPrice / 100}
                onChange={(e) => { setMonthlyPrice(Math.round(Number(e.target.value) * 100)); setSelectedTariff('') }}
                className="tabular-nums"
              />
            </Field>
          )}
          <Button onClick={handleAdd} disabled={!selectedStudentId} loading={adding} className="w-full sm:w-auto">
            Añadir al grupo
          </Button>
        </div>
      </div>
    </Card>
  )
}
