'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface UnpaidItem {
  id: string
  schedule_id: string
  student_name: string
  student_email: string
  start_time: string | null
  monthly_price: number
  paid_until: string | null
  months_overdue: number
}

export function UnpaidList({ items, monthLabel }: { items: UnpaidItem[]; monthLabel: string }) {
  const [list, setList] = useState(items)
  const [q, setQ] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState(0)
  const [saving, setSaving] = useState(false)

  const filtered = list.filter((e) =>
    !q ||
    e.student_name?.toLowerCase().includes(q.toLowerCase()) ||
    e.student_email?.toLowerCase().includes(q.toLowerCase())
  )

  async function handleSavePrice(id: string) {
    setSaving(true)
    const res = await fetch(`/api/group-enrollments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthly_price: editingPrice }),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error('No se pudo actualizar la cuota')
      return
    }
    setList((prev) => prev.map((e) => e.id === id ? { ...e, monthly_price: editingPrice } : e))
    setEditingId(null)
    toast.success('Cuota actualizada')
  }

  if (!list.length) {
    return (
      <p className="px-6 py-8 text-center text-sm text-brand-500 font-medium">
        ✓ Todos los alumnos están al día en {monthLabel}
      </p>
    )
  }

  return (
    <div>
      <div className="px-6 py-3 border-b border-gray-100">
        <input
          type="text"
          placeholder="Buscar alumno..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Alumno</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Clase</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Deuda</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Último pago</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">Sin resultados.</td>
              </tr>
            )}
            {filtered.map((e) => {
              const dow = e.start_time ? new Date(e.start_time).getDay() : null
              const time = e.start_time
                ? new Date(e.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                : null
              const totalOwed = e.monthly_price * e.months_overdue
              const isAccumulated = e.months_overdue > 1

              return (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{e.student_name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{e.student_email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {dow !== null ? `${DAYS[dow]} ${time}` : '—'}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === e.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min={0} step={0.5}
                          value={editingPrice / 100}
                          onChange={(ev) => setEditingPrice(Math.round(Number(ev.target.value) * 100))}
                          className="w-20 rounded border border-gray-200 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                          autoFocus
                        />
                        <button onClick={() => handleSavePrice(e.id)} disabled={saving}
                          className="text-xs font-medium text-brand-500">
                          {saving ? '...' : '✓'}
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">✕</button>
                      </div>
                    ) : (
                      <div>
                        <button
                          onClick={() => { setEditingId(e.id); setEditingPrice(e.monthly_price) }}
                          className="text-sm font-semibold text-yellow-600 hover:text-yellow-700"
                          title="Editar cuota mensual"
                        >
                          {formatCurrency(e.monthly_price)}/mes ✎
                        </button>
                        {isAccumulated ? (
                          <p className="mt-0.5 text-xs font-medium text-red-500">
                            {e.months_overdue} meses · Total: {formatCurrency(totalOwed)}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-gray-400">1 mes pendiente</p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {e.paid_until
                      ? new Date(e.paid_until).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Nunca'}
                  </td>
                  <td className="px-6 py-4">
                    <a href={`/dashboard/schedule/${e.schedule_id}`}
                      className="text-xs font-medium text-brand-500 hover:underline whitespace-nowrap">
                      Marcar pagado →
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
