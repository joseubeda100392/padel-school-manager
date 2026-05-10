'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface Enrollment {
  id: string
  monthly_price: number
  paid_until: string | null
  start_date: string | null
  end_date: string | null
  schedule: { id: string; start_time: string; court: { name: string } | null } | null
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function isPaidThisMonth(paidUntil: string | null) {
  if (!paidUntil) return false
  const now = new Date()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return new Date(paidUntil) >= endOfMonth
}

export function StudentEnrollments({ initialEnrollments }: { initialEnrollments: Enrollment[] }) {
  const [enrollments, setEnrollments] = useState(initialEnrollments)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState(0)
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const currentMonth = MONTHS[now.getMonth()]

  async function handleSavePrice(id: string) {
    setSaving(true)
    await fetch(`/api/group-enrollments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthly_price: editingPrice }),
    })
    setEnrollments((prev) =>
      prev.map((e) => e.id === id ? { ...e, monthly_price: editingPrice } : e)
    )
    setEditingId(null)
    setSaving(false)
  }

  if (!enrollments.length) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-semibold text-gray-900">Clases y cuotas</h2>
        <p className="text-sm text-gray-400">No está inscrito en ninguna clase de grupo fijo.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">Clases y cuotas</h2>
        <p className="text-xs text-gray-400">{enrollments.length} inscripción{enrollments.length !== 1 ? 'es' : ''} activa{enrollments.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="divide-y divide-gray-50">
        {enrollments.map((e) => {
          const paid = isPaidThisMonth(e.paid_until)
          const dow = e.schedule?.start_time ? new Date(e.schedule.start_time).getDay() : null
          const time = e.schedule?.start_time
            ? new Date(e.schedule.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            : null
          return (
            <div key={e.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {dow !== null ? `${DAYS[dow]} ${time}` : '—'} · {e.schedule?.court?.name ?? '—'}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-gray-400">
                  {e.start_date && <span>Alta: {new Date(e.start_date).toLocaleDateString('es-ES')}</span>}
                  {e.end_date && <span>Baja: {new Date(e.end_date).toLocaleDateString('es-ES')}</span>}
                </div>
              </div>

              {editingId === e.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number" min={0} step={0.5}
                    value={editingPrice / 100}
                    onChange={(ev) => setEditingPrice(Math.round(Number(ev.target.value) * 100))}
                    className="w-24 rounded border border-gray-200 px-2 py-1 text-sm focus:border-green-500 focus:outline-none"
                    autoFocus
                  />
                  <span className="text-sm text-gray-400">€/mes</span>
                  <button onClick={() => handleSavePrice(e.id)} disabled={saving}
                    className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700">
                    {saving ? '...' : '✓'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingId(e.id); setEditingPrice(e.monthly_price) }}
                  className="text-sm font-semibold text-gray-700 hover:text-green-600"
                  title="Editar cuota"
                >
                  {formatCurrency(e.monthly_price)} ✎
                </button>
              )}

              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {paid ? 'Al día' : `Pdte. ${currentMonth}`}
              </span>

              <a href={`/dashboard/schedule/${e.schedule?.id}`}
                className="text-xs font-medium text-green-600 hover:underline shrink-0">
                Ver clase →
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
