'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/confirm'

interface Tx {
  id: string
  delta: number
  reason: string | null
}

export function BagHistoryList({ initial, canDelete }: { initial: Tx[]; canDelete: boolean }) {
  const confirm = useConfirm()
  const [history, setHistory] = useState(initial)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: '¿Borrar este movimiento?',
      description: 'Solo se borra el registro del historial. El saldo actual del alumno no cambia.',
      confirmLabel: 'Borrar movimiento',
      destructive: true,
    })
    if (!ok) return
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
    <div className="border-t border-line pt-4">
      <p className="mb-1 text-label text-ink-2">Últimos movimientos</p>
      <ul className="divide-y divide-line">
        {history.map((t) => (
          <li key={t.id} className="flex min-h-11 items-center justify-between gap-2 text-body">
            <span className="min-w-0 truncate text-ink-2">{t.reason || 'Sin motivo'}</span>
            <div className="flex shrink-0 items-center gap-1">
              <span className={`text-label tabular-nums ${t.delta > 0 ? 'text-accent-ink' : 'text-danger-ink'}`}>
                {t.delta > 0 ? '+' : ''}{t.delta}
              </span>
              {canDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  aria-label="Borrar movimiento del historial"
                  title="Borrar del historial (solo super admin). No toca el saldo."
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
