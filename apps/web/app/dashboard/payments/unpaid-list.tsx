'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { Check, CircleCheck, Pencil, Search, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/feedback'

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
      <EmptyState
        icon={<CircleCheck />}
        title={`Todos al día en ${monthLabel}`}
        description="No hay mensualidades pendientes."
      />
    )
  }

  return (
    <div>
      <div className="px-4 py-3 sm:px-5">
        <label htmlFor="unpaid-search" className="sr-only">Buscar alumno</label>
        <div className="relative max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input
            id="unpaid-search"
            type="search"
            placeholder="Buscar alumno"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-meta font-medium text-ink-3">
              <th scope="col" className="px-4 py-3 sm:px-5">Alumno</th>
              <th scope="col" className="px-4 py-3">Clase</th>
              <th scope="col" className="px-4 py-3 text-right">Deuda</th>
              <th scope="col" className="px-4 py-3">Último pago</th>
              <th scope="col" className="px-4 py-3 sm:px-5"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-body text-ink-3">Sin resultados.</td>
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
                <tr key={e.id} className="hover:bg-ink/[0.03]">
                  <td className="px-4 py-3 sm:px-5">
                    <p className="text-label text-ink">{e.student_name ?? '—'}</p>
                    <p className="text-meta text-ink-3">{e.student_email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-body tabular-nums text-ink-2">
                    {dow !== null ? `${DAYS[dow]} ${time}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === e.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Cuota mensual de ${e.student_name} en euros`}
                          onFocus={e => e.target.select()}
                          value={editingPrice === 0 ? '' : String(editingPrice / 100)}
                          onChange={(ev) => setEditingPrice(Math.round(Number(ev.target.value) * 100))}
                          className="w-24 tabular-nums"
                          autoFocus
                        />
                        <Button size="icon" loading={saving} aria-label="Guardar cuota" onClick={() => handleSavePrice(e.id)}>
                          <Check className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="Cancelar edición" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => { setEditingId(e.id); setEditingPrice(e.monthly_price) }}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-label tabular-nums text-warn-ink hover:bg-warn-soft"
                          aria-label={`Editar cuota mensual, ahora ${formatCurrency(e.monthly_price)}`}
                        >
                          {formatCurrency(e.monthly_price)}/mes
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        {isAccumulated ? (
                          <p className="text-meta font-medium tabular-nums text-danger-ink">
                            {e.months_overdue} meses · Total: {formatCurrency(totalOwed)}
                          </p>
                        ) : (
                          <p className="text-meta text-ink-3">1 mes pendiente</p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-body tabular-nums text-ink-2">
                    {e.paid_until
                      ? new Date(e.paid_until).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Nunca'}
                  </td>
                  <td className="px-4 py-3 text-right sm:px-5">
                    <Link
                      href={`/dashboard/schedule/${e.schedule_id}`}
                      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                      Marcar pagado
                    </Link>
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
