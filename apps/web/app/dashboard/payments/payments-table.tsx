'use client'

import { useState } from 'react'
import { formatDate, formatCurrency } from '@/lib/utils'

const statusBadge: Record<string, string> = {
  succeeded: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-500',
}

const statusLabel: Record<string, string> = {
  succeeded: 'Completado',
  pending: 'Pendiente',
  failed: 'Fallido',
  refunded: 'Reembolsado',
}

const typeLabel: Record<string, string> = {
  subscription: 'Suscripción',
  pay_per_class: 'Clase suelta',
  bag_pack: 'Bolsa de clases',
  manual: 'Manual',
}

export default function PaymentsTable({ payments }: { payments: any[] }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')

  const filtered = payments.filter((p) => {
    const matchQ = !q ||
      p.user?.name?.toLowerCase().includes(q.toLowerCase()) ||
      p.user?.email?.toLowerCase().includes(q.toLowerCase())
    const matchStatus = !status || p.status === status
    return matchQ && matchStatus
  })

  function exportCSV() {
    const headers = ['Alumno', 'Email', 'Tipo', 'Importe (€)', 'Estado', 'Fecha']
    const rows = filtered.map((p) => [
      p.user?.name ?? '',
      p.user?.email ?? '',
      typeLabel[p.type] ?? p.type,
      (p.amount / 100).toFixed(2),
      statusLabel[p.status] ?? p.status,
      formatDate(p.created_at),
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'pagos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const total = filtered.reduce((acc, p) => p.status === 'succeeded' ? acc + p.amount : acc, 0)

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por alumno o email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="succeeded">Completados</option>
          <option value="pending">Pendientes</option>
          <option value="failed">Fallidos</option>
          <option value="refunded">Reembolsados</option>
        </select>
        {(q || status) && (
          <button
            onClick={() => { setQ(''); setStatus('') }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Limpiar
          </button>
        )}
        <button
          onClick={exportCSV}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          ↓ CSV
        </button>
      </div>

      <p className="mb-3 text-sm text-gray-400">
        {filtered.length} de {payments.length} transacciones
        {filtered.length > 0 && (
          <span className="ml-2 font-medium text-gray-600">· Total filtrado: {formatCurrency(total)}</span>
        )}
      </p>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Alumno</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Importe</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    {q || status ? 'Sin resultados para esa búsqueda.' : 'No hay pagos aún.'}
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{p.user?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{p.user?.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{typeLabel[p.type] ?? p.type}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {formatCurrency(p.amount, p.currency ?? 'EUR')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {statusLabel[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
