'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StudentCombobox } from '@/components/student-combobox'

interface Enrollment {
  id: string
  monthly_price: number
  paid_until: string | null
  status: string
  student: { id: string; name: string; email: string }
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
  return next.toISOString().split('T')[0]
}

export default function GroupEnrollment({
  scheduleId,
  scheduleStartTime,
  initialEnrollments,
  initialExclusions,
  availableStudents,
  defaultMonthlyPrice,
}: {
  scheduleId: string
  scheduleStartTime: string
  initialEnrollments: Enrollment[]
  initialExclusions: Record<string, Exclusion[]>
  availableStudents: Student[]
  defaultMonthlyPrice: number
}) {
  const router = useRouter()
  const [enrollments, setEnrollments] = useState(initialEnrollments)
  const [exclusions, setExclusions] = useState<Record<string, Exclusion[]>>(initialExclusions)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [monthlyPrice, setMonthlyPrice] = useState(defaultMonthlyPrice)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [markPaidError, setMarkPaidError] = useState<string | null>(null)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState(0)
  const [faltaFormId, setFaltaFormId] = useState<string | null>(null)
  const [faltaDate, setFaltaDate] = useState('')
  const [faltaPublish, setFaltaPublish] = useState(true)
  const [faltaLoading, setFaltaLoading] = useState(false)

  const now = new Date()
  const currentMonth = MONTH_NAMES[now.getMonth()]
  const currentYear = now.getFullYear()
  const nextOccurrence = getNextOccurrence(scheduleStartTime)

  const enrolledIds = new Set(enrollments.map((e) => e.student.id))
  const unenrolledStudents = availableStudents.filter((s) => !enrolledIds.has(s.id))

  async function handleAdd() {
    if (!selectedStudentId) return
    setAdding(true)
    setAddError('')
    const res = await fetch('/api/group-enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId, studentId: selectedStudentId, monthlyPrice }),
    })
    const json = await res.json()
    if (res.ok) {
      const student = availableStudents.find((s) => s.id === selectedStudentId)!
      setEnrollments((prev) => [...prev, { ...json.data, student }])
      setSelectedStudentId('')
      router.refresh()
    } else {
      setAddError(json.error ?? 'No se pudo añadir al alumno')
    }
    setAdding(false)
  }

  async function handleRemove(id: string) {
    if (!confirm('¿Quitar al alumno del grupo fijo?')) return
    setLoadingId(id)
    await fetch(`/api/group-enrollments/${id}`, { method: 'DELETE' })
    setEnrollments((prev) => prev.filter((e) => e.id !== id))
    setLoadingId(null)
    router.refresh()
  }

  async function handleUpdatePrice(id: string) {
    setLoadingId(id)
    await fetch(`/api/group-enrollments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthly_price: editingPriceValue }),
    })
    setEnrollments((prev) =>
      prev.map((e) => e.id === id ? { ...e, monthly_price: editingPriceValue } : e)
    )
    setEditingPriceId(null)
    setLoadingId(null)
  }

  async function handleMarkPaid(id: string) {
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
      router.refresh()
    }
    setFaltaLoading(false)
  }

  async function handleDeleteExclusion(enrollmentId: string, exclusionId: string) {
    await fetch('/api/schedule-exclusions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: exclusionId }),
    })
    setExclusions((prev) => ({
      ...prev,
      [enrollmentId]: (prev[enrollmentId] ?? []).filter((x) => x.id !== exclusionId),
    }))
  }

  async function handleTogglePublish(enrollmentId: string, exclusion: Exclusion) {
    await fetch('/api/schedule-exclusions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: exclusion.id, publish_spot: !exclusion.publish_spot }),
    })
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
          Alumnos con plaza permanente · Cuota de {currentMonth} {currentYear}
        </p>
      </div>

      {markPaidError && (
        <p className="mx-6 mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{markPaidError}</p>
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

                  {editingPriceId === e.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} step={0.5}
                        value={editingPriceValue / 100}
                        onChange={(ev) => setEditingPriceValue(Math.round(Number(ev.target.value) * 100))}
                        className="w-20 rounded border border-gray-200 px-2 py-1 text-sm focus:border-green-500 focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => handleUpdatePrice(e.id)} className="text-xs font-medium text-green-600">✓</button>
                      <button onClick={() => setEditingPriceId(null)} className="text-xs text-gray-400">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingPriceId(e.id); setEditingPriceValue(e.monthly_price) }}
                      className="text-sm font-medium text-gray-600 hover:text-green-600"
                      title="Editar cuota"
                    >
                      {(e.monthly_price / 100).toFixed(2)}€/mes ✎
                    </button>
                  )}

                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {paid ? 'Pagado' : `Pendiente ${currentMonth}`}
                  </span>

                  {!paid && (
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
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Publicar plaza libre</label>
                        <button
                          onClick={() => setFaltaPublish(!faltaPublish)}
                          className={`relative h-6 w-11 rounded-full transition-colors ${faltaPublish ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${faltaPublish ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                        <span className="text-xs text-gray-400">{faltaPublish ? 'Sí' : 'No'}</span>
                      </div>
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
                          className={`text-xs font-medium ${x.publish_spot ? 'text-green-600' : 'text-gray-400'}`}
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
          <div className="relative">
            <input
              type="number"
              min={0}
              step={0.5}
              value={monthlyPrice / 100}
              onChange={(e) => setMonthlyPrice(Math.round(Number(e.target.value) * 100))}
              className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
              placeholder="Precio/mes"
            />
            <span className="pointer-events-none absolute right-3 top-2 text-sm text-gray-400">€</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !selectedStudentId}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {adding ? '...' : 'Añadir'}
          </button>
        </div>
      </div>
    </div>
  )
}
