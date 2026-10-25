'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { dayBefore, madridToday } from '@/lib/enrollment-window'
import type { AvailableGroup } from '@/lib/available-groups'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { useConfirm } from '@/components/ui/confirm'
import { StartDatePicker } from '@/components/start-date-picker'

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES')

// "Cambiar de grupo" de una inscripción, desde la ficha del alumno o desde la
// clase. El grupo nuevo hereda lo pagado y lo pendiente; con fecha, sigue en el
// viejo hasta el día anterior (no es una baja, no se le desactiva).
export function MoveGroupPanel({
  enrollment,
  studentId,
  studentName,
  availableGroups,
  excludeScheduleIds,
  onClose,
}: {
  enrollment: { id: string; monthly_price: number; discount_applied?: boolean }
  studentId: string
  studentName?: string
  availableGroups: AvailableGroup[]
  excludeScheduleIds: string[]
  onClose: () => void
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [target, setTarget] = useState('')
  const [price, setPrice] = useState(enrollment.monthly_price)
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleMove() {
    const group = availableGroups.find(g => g.id === target)
    if (!group) return
    const priceChanged = price !== enrollment.monthly_price
    const scheduled = !!date && date > madridToday()
    const who = studentName ?? 'el alumno'
    const lines = [
      scheduled
        ? `${studentName ?? 'Sigue'}${studentName ? ' sigue' : ''} en su grupo actual hasta el ${fmtDate(dayBefore(date))} y desde el ${fmtDate(date)} pasa al nuevo. No es una baja: no se le desactiva.`
        : `Se quita a ${who} de su grupo actual y lo pagado o pendiente pasa al nuevo.`,
      priceChanged ? `Cuota nueva: ${formatCurrency(price)}/mes.` : '',
      priceChanged && enrollment.discount_applied && !scheduled ? 'El descuento marcado no se mantiene al cambiar la cuota.' : '',
    ].filter(Boolean)
    const ok = await confirm({
      title: `¿Cambiar al grupo ${group.label}?`,
      description: lines.join(' '),
      confirmLabel: scheduled ? 'Programar cambio' : 'Cambiar de grupo',
      cancelLabel: 'Cancelar',
    })
    if (!ok) return
    setSaving(true)
    try {
      const res = await fetch('/api/group-enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: group.id, studentId, monthlyPrice: price, replacesEnrollmentId: enrollment.id, ...(scheduled ? { startDate: date } : {}) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'No se pudo cambiar de grupo')
        return
      }
      toast.success(scheduled ? `Cambio programado: pasa al grupo nuevo el ${fmtDate(date)}` : 'Cambio de grupo hecho')
      onClose()
      router.refresh()
    } catch {
      toast.error('Error de conexión. No se ha cambiado de grupo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full basis-full rounded-card border border-line bg-surface-2 p-3">
      <p className="mb-2 text-meta text-ink-2">
        {date
          ? `Sigue en este grupo hasta el ${fmtDate(dayBefore(date))}. Lo que haya pagado de después pasa al nuevo.`
          : 'Lo pagado y lo pendiente de este grupo pasan al nuevo.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={target}
          onChange={(ev) => setTarget(ev.target.value)}
          className="w-full sm:w-auto sm:min-w-[320px]"
          aria-label="Grupo nuevo"
        >
          <option value="">Elige el grupo nuevo…</option>
          {availableGroups
            .filter(g => !excludeScheduleIds.includes(g.id))
            .map(g => (
              <option key={g.id} value={g.id} disabled={g.full && !date}>
                {g.label}{g.full ? (date ? ' (hoy completo)' : ' (completo)') : ''}
              </option>
            ))}
        </Select>
        <StartDatePicker value={date} onChange={setDate} todayLabel="Desde ya" />
        <label className="flex items-center gap-1.5 text-meta text-ink-2">
          <Input
            type="text"
            inputMode="decimal"
            onFocus={ev => ev.target.select()}
            value={price === 0 ? '' : String(price / 100)}
            onChange={(ev) => setPrice(Math.round(Number(ev.target.value) * 100))}
            className="w-24"
            aria-label="Cuota en el grupo nuevo"
          />
          €/mes
        </label>
        <Button size="sm" className="w-full sm:w-auto" onClick={handleMove} disabled={!target || saving}>
          {saving ? 'Guardando…' : date ? 'Programar cambio' : 'Confirmar cambio'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  )
}
