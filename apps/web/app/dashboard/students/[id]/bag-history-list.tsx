'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface Tx {
  id: string
  delta: number
  reason: string | null
}

export function BagHistoryList({ initial, canDelete }: { initial: Tx[]; canDelete: boolean }) {
  const [history, setHistory] = useState(initial)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('¿Borrar este movimiento del historial? Solo borra el registro — no toca el saldo actual del alumno.')) return
    setDeletingId(id)
    const res = await fetch(`/api/admin/bag-transactions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setHistory((prev) => prev.filter((t) => t.id !== id))
      toast.success('Movimiento borrado')
    } else {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error ?? 'No se pudo borrar')
    }
    setDeletingId(null)
  }

  if (history.length === 0) return null

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <p className="mb-2 text-xs font-medium uppercase text-gray-400">Últimos movimientos</p>
      <ul className="space-y-1.5">
        {history.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-600">{t.reason || 'Sin motivo'}</span>
            <div className="flex items-center gap-2">
              <span className={t.delta > 0 ? 'font-medium text-brand-500' : 'font-medium text-red-600'}>
                {t.delta > 0 ? '+' : ''}{t.delta}
              </span>
              {canDelete && (
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  title="Borrar del historial (solo super admin) — no toca el saldo"
                  className="text-gray-300 hover:text-red-500 disabled:opacity-40"
                >
                  ×
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
