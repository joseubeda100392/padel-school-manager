'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function isPaidThisMonth(paidUntil: string | null) {
  if (!paidUntil) return false
  const now = new Date()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return new Date(paidUntil) >= endOfMonth
}

export default function GroupEnrollment({
  scheduleId,
  initialEnrollments,
  availableStudents,
  defaultMonthlyPrice,
}: {
  scheduleId: string
  initialEnrollments: Enrollment[]
  availableStudents: Student[]
  defaultMonthlyPrice: number
}) {
  const router = useRouter()
  const [enrollments, setEnrollments] = useState(initialEnrollments)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [monthlyPrice, setMonthlyPrice] = useState(defaultMonthlyPrice)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState(0)

  const now = new Date()
  const currentMonth = MONTH_NAMES[now.getMonth()]
  const currentYear = now.getFullYear()

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
    const res = await fetch(`/api/group-enrollments/${id}/mark-paid`, { method: 'POST' })
    const json = await res.json()
    if (res.ok) {
      setEnrollments((prev) =>
        prev.map((e) => e.id === id ? { ...e, paid_until: json.paidUntil } : e)
      )
    }
    setLoadingId(null)
  }

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">Grupo fijo</h2>
        <p className="mt-0.5 text-xs text-gray-400">
          Alumnos con plaza permanente · Cuota de {currentMonth} {currentYear}
        </p>
      </div>

      {enrollments.length === 0 ? (
        <p className="px-6 py-6 text-sm text-gray-400">No hay alumnos en el grupo fijo aún.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {enrollments.map((e) => {
            const paid = isPaidThisMonth(e.paid_until)
            const isLoading = loadingId === e.id
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
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
                  {paid ? `Pagado` : `Pendiente ${currentMonth}`}
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
                  onClick={() => handleRemove(e.id)}
                  disabled={isLoading}
                  className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                >
                  {isLoading ? '...' : 'Quitar'}
                </button>
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
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="flex-1 min-w-[180px] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
          >
            <option value="">Seleccionar alumno...</option>
            {unenrolledStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
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
