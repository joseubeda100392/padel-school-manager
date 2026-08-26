'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StudentCombobox } from '@/components/student-combobox'
import { getDayOfWeek } from '@/lib/utils'

interface Enrollment {
  id: string
  monthly_price: number
  price_per_class_cents?: number | null
  court_pricing?: 'con_pista' | 'sin_pista' | null
  discount_classes_pending?: number
  paid_until: string | null
  status: string
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

function getNextOccurrence(startTime: string): string {
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
}) {
  const router = useRouter()
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
  const currentMonth = MONTH_NAMES[now.getMonth()]
  const currentYear = now.getFullYear()
  const nextOccurrence = getNextOccurrence(scheduleStartTime)

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
  function billingTarget(): { count: number; monthLabel: string } {
    const dow = getDayOfWeek(scheduleStartTime)
    const todayMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
    const [ty, tm, td] = todayMadrid.split('-').map(Number)
    const thisMonth0 = tm - 1

    const remaining = countOccurrences(dow, ty, thisMonth0, td)
    if (remaining > 0) {
      return { count: remaining, monthLabel: `${MONTH_NAMES[thisMonth0]} ${ty}` }
    }
    const next = new Date(ty, thisMonth0 + 1, 1)
    const nextCount = countOccurrences(dow, next.getFullYear(), next.getMonth(), 1)
    return { count: nextCount, monthLabel: `${MONTH_NAMES[next.getMonth()]} ${next.getFullYear()}` }
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
    if (!confirm('¿Quitar al alumno del grupo fijo?')) return
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

  async function handleMarkPaid(id: string) {
    if (!confirm('¿Registrar el pago en efectivo de este mes? Quedará registrado en el historial de pagos.')) return
    setLoadingId(id)
    setMarkPaidError(null)
    const res = await fetch(`/api/group-enrollments/${id}/mark-paid`, { method: 'POST' })
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
        setFaltaSuccessMsg(`✓ +1 clase añadida a la bolsa de ${studentName} · Saldo actual: ${json.newBagBalance} clase${json.newBagBalance !== 1 ? 's' : ''}`)
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
    <div className="rounded-xl bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">Grupo fijo</h2>
        <p className="mt-0.5 text-xs text-gray-400">
          Alumnos con plaza permanente{enablePayments ? ` · Cuota de ${currentMonth} ${currentYear}` : ''}
        </p>
      </div>

      {markPaidError && (
        <p className="mx-6 mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{markPaidError}</p>
      )}

      {faltaSuccessMsg && (
        <p className="mx-6 mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-600">{faltaSuccessMsg}</p>
      )}

      {enrollments.length === 0 ? (
        <p className="px-6 py-6 text-sm text-gray-400">No hay alumnos en el grupo fijo aún.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {enrollments.map((e) => {
            const paid = isPaidThisMonth(e.paid_until)
            const isLoading = loadingId === e.id
            const myExclusions = (exclusions[e.id] ?? []).filter(x => x.excluded_date >= now.toISOString().split('T')[0])
            const showFaltaForm = faltaFormId === e.id

            return (
              <div key={e.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{e.student.name}</p>
                    <p className="text-xs text-gray-400">{e.student.email}</p>
                  </div>

                  {enablePayments && (editingPriceId === e.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        onFocus={e => e.target.select()}
                        value={editingPriceValue === 0 ? '' : String(editingPriceValue / 100)}
                        onChange={(ev) => setEditingPriceValue(Math.round(Number(ev.target.value) * 100))}
                        className="w-20 rounded border border-gray-200 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleUpdatePrice(e.id)} className="text-xs font-medium text-brand-500">✓</button>
                      <button onClick={() => setEditingPriceId(null)} className="text-xs text-gray-400">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingPriceId(e.id); setEditingPriceValue(e.monthly_price) }}
                      className="text-sm font-medium text-gray-600 hover:text-brand-500"
                      title="Editar cuota"
                    >
                      {(e.monthly_price / 100).toFixed(2)}€/mes ✎
                    </button>
                  ))}

                  {enableClassValidation && enablePayments && (editingPerClassId === e.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        onFocus={ev => ev.target.select()}
                        value={editingPerClassValue === 0 ? '' : String(editingPerClassValue / 100)}
                        onChange={(ev) => setEditingPerClassValue(Math.round(Number(ev.target.value) * 100))}
                        className="w-20 rounded border border-gray-200 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleUpdatePerClassPrice(e.id)} className="text-xs font-medium text-brand-500">✓</button>
                      <button onClick={() => setEditingPerClassId(null)} className="text-xs text-gray-400">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingPerClassId(e.id); setEditingPerClassValue(e.price_per_class_cents ?? 0) }}
                      className="text-xs font-medium text-gray-500 hover:text-brand-500"
                      title="Precio por clase suelta (para el descuento de clases no dadas)"
                    >
                      {e.price_per_class_cents ? `${(e.price_per_class_cents / 100).toFixed(2)}€/clase ✎` : 'Sin precio/clase ✎'}
                    </button>
                  ))}

                  {enableClassValidation && (e.discount_classes_pending ?? 0) > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                      −{e.discount_classes_pending} clase{e.discount_classes_pending === 1 ? '' : 's'} el próximo cobro
                    </span>
                  )}

                  {enablePayments && (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${paid ? 'bg-brand-100 text-brand-600' : 'bg-red-100 text-red-600'}`}>
                      {paid ? 'Pagado' : `Pendiente ${currentMonth}`}
                    </span>
                  )}

                  {enablePayments && !paid && (
                    <button
                      onClick={() => handleMarkPaid(e.id)}
                      disabled={isLoading}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isLoading ? '...' : 'Efectivo ✓'}
                    </button>
                  )}

                  <button
                    onClick={() => showFaltaForm ? setFaltaFormId(null) : openFaltaForm(e.id)}
                    disabled={isLoading}
                    className="rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                  >
                    Registrar falta
                  </button>

                  <button
                    onClick={() => handleRemove(e.id)}
                    disabled={isLoading}
                    className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    {isLoading ? '...' : 'Quitar'}
                  </button>
                </div>

                {/* Formulario de falta */}
                {showFaltaForm && (
                  <div className="mt-3 rounded-lg border border-orange-100 bg-orange-50 p-4">
                    <p className="mb-3 text-xs font-semibold text-orange-700">Registrar falta — {e.student.name}</p>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Fecha de la clase</label>
                        <input
                          type="date"
                          value={faltaDate}
                          min={now.toISOString().split('T')[0]}
                          onChange={(ev) => setFaltaDate(ev.target.value)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
                        />
                      </div>
                      {enableSpots && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600">Publicar plaza libre</label>
                          <button
                            onClick={() => setFaltaPublish(!faltaPublish)}
                            className={`relative h-6 w-11 rounded-full transition-colors ${faltaPublish ? 'bg-brand-500' : 'bg-gray-300'}`}
                          >
                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${faltaPublish ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                          <span className="text-xs text-gray-400">{faltaPublish ? 'Sí' : 'No'}</span>
                        </div>
                      )}
                      <button
                        onClick={() => handleRegistrarFalta(e.id)}
                        disabled={faltaLoading || !faltaDate}
                        className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        {faltaLoading ? '...' : 'Confirmar falta'}
                      </button>
                      <button onClick={() => setFaltaFormId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      {faltaPublish
                        ? '✓ El alumno recibe +1 clase disponible y la plaza se publica en la app'
                        : '✓ El alumno recibe +1 clase disponible · la plaza no se publica'}
                    </p>
                  </div>
                )}

                {/* Faltas próximas registradas */}
                {myExclusions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {myExclusions.map((x) => (
                      <div key={x.id} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                        <span className="text-xs text-gray-500">
                          Falta {new Date(x.excluded_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                        <button
                          onClick={() => handleTogglePublish(e.id, x)}
                          className={`text-xs font-medium ${x.publish_spot ? 'text-brand-500' : 'text-gray-400'}`}
                          title={x.publish_spot ? 'Plaza publicada · click para ocultar' : 'Plaza no publicada · click para publicar'}
                        >
                          {x.publish_spot ? '● Publicada' : '○ No publicada'}
                        </button>
                        <button
                          onClick={() => handleDeleteExclusion(e.id, x.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                          title="Eliminar falta"
                        >
                          ×
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

      <div className="border-t border-gray-100 px-6 py-4">
        <p className="mb-3 text-xs font-medium text-gray-500">Añadir alumno al grupo fijo</p>
        {addError && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{addError}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <StudentCombobox
            students={unenrolledStudents}
            value={selectedStudentId}
            onChange={setSelectedStudentId}
            placeholder="Buscar alumno por nombre o email..."
          />
          {enablePayments && enableClassValidation && (courtPricing || otherTariffs) && (
            <select
              value={selectedTariff}
              onChange={(e) => handleSelectTariff(e.target.value as TariffChoice)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="" disabled>Elige tarifa...</option>
              {(['clase_suelta', 'con_pista', 'sin_pista'] as TariffChoice[]).map((tariff) => (
                <option key={tariff} value={tariff}>
                  {TARIFF_LABELS[tariff]} ({(tariffPricePerClass(tariff) / 100).toFixed(2)}€/clase)
                </option>
              ))}
            </select>
          )}
          {selectedTariff && (
            <span className="flex items-center text-xs text-gray-400">
              Cuota de {billingTarget().monthLabel}
            </span>
          )}
          {enablePayments && (
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                onFocus={e => e.target.select()}
                min={0}
                step={0.5}
                value={monthlyPrice / 100}
                onChange={(e) => { setMonthlyPrice(Math.round(Number(e.target.value) * 100)); setSelectedTariff('') }}
                className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="Precio/mes"
              />
              <span className="pointer-events-none absolute right-3 top-2 text-sm text-gray-400">€</span>
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={adding || !selectedStudentId}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {adding ? '...' : 'Añadir'}
          </button>
        </div>
      </div>
    </div>
  )
}
