'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { useConfirm } from '@/components/ui/confirm'
import { Field, Input, Select } from '@/components/ui/field'
import { dayBefore, madridToday } from '@/lib/enrollment-window'

const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

export function ScheduleActions({ scheduleId, nextDate, recurring = false, fixedStudents = [] }: {
  scheduleId: string
  nextDate: string
  // Clase que se repite: se puede quitar a partir de un día sin borrar lo anterior.
  recurring?: boolean
  // Alumnos del grupo fijo, para avisar de que salen del grupo al quitar la clase.
  fixedStudents?: string[]
}) {
  const confirm = useConfirm()
  const [deleting, setDeleting] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelMsg, setCancelMsg] = useState('')
  const [showEnd, setShowEnd] = useState(false)
  const [endWhen, setEndWhen] = useState<'month_end' | 'other'>('month_end')
  const [endOther, setEndOther] = useState('')
  const [ending, setEnding] = useState(false)
  const today = madridToday()
  const monthEnd = (() => { const [y, m] = today.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) })()
  const endLastDay = endWhen === 'month_end' ? monthEnd : endOther

  // Quitar la clase a partir de un día: lo anterior se queda como estaba.
  async function handleEnd() {
    if (!endLastDay) return
    setEnding(true)
    const res = await fetch(`/api/admin/schedules/${scheduleId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastDay: endLastDay }),
    })
    const json = await res.json().catch(() => ({}))
    setEnding(false)
    if (!res.ok) {
      toast.error(json.error ?? 'No se ha podido quitar la clase')
      return
    }
    setShowEnd(false)
    toast.success(`Clase quitada: el último día es el ${fmt(json.lastDay)}.${json.paidByCard ? ` Hay ${json.paidByCard} reserva(s) pagada(s) con tarjeta después de esa fecha: devuelve el dinero aparte.` : ''}`)
    window.location.reload()
  }

  async function handleDelete() {
    if (!(await confirm({
      title: '¿Eliminar esta clase?',
      description: 'Se eliminarán también todas las reservas asociadas. No se puede deshacer.',
      confirmLabel: 'Eliminar clase',
      destructive: true,
    }))) return
    setDeleting(true)
    const res = await fetch('/api/admin/schedules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error ?? `No se pudo eliminar la clase: ${res.statusText}`)
      setDeleting(false)
      return
    }
    window.location.href = '/dashboard/schedule'
  }

  async function handleCancelSession(creditBags: boolean) {
    setCancelling(true)
    const res = await fetch('/api/admin/schedules/cancel-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId, date: nextDate, creditBags }),
    })
    const json = await res.json()
    setCancelling(false)
    setShowCancelModal(false)
    if (res.ok) {
      setCancelMsg(creditBags
        ? `Sesión cancelada. +1 clase añadida a la bolsa de ${json.credited} alumnos.`
        : 'Sesión cancelada sin crédito a bolsas.')
    } else {
      toast.error(json.error ?? 'No se ha podido cancelar la sesión. Vuelve a intentarlo.')
    }
  }

  return (
    <>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <Link href={`/dashboard/schedule/${scheduleId}/edit`} className={buttonVariants({ variant: 'secondary' })}>
          Editar
        </Link>
        <Button variant="secondary" onClick={() => setShowCancelModal(true)}>
          Cancelar sesión
        </Button>
        {recurring && (
          <Button variant="secondary" onClick={() => setShowEnd(true)}>
            Quitar a partir de un día
          </Button>
        )}
        <Button variant="danger-ghost" onClick={handleDelete} loading={deleting}>
          {deleting ? 'Eliminando…' : 'Eliminar clase'}
        </Button>
      </div>

      {cancelMsg && (
        <p role="status" className="mt-2 w-full text-meta font-medium text-accent-ink">{cancelMsg}</p>
      )}

      <Sheet
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancelar sesión"
        description="¿Por qué cancelas esta sesión? Esto determina si los alumnos recuperan la clase en su bolsa."
        footer={
          <div className="flex w-full flex-col gap-2">
            <Button size="lg" onClick={() => handleCancelSession(true)} disabled={cancelling}>
              La clase no se da: +1 en la bolsa de cada alumno
            </Button>
            <Button variant="secondary" size="lg" onClick={() => handleCancelSession(false)} disabled={cancelling}>
              Error al crear la clase: sin crédito a bolsas
            </Button>
            <Button variant="ghost" onClick={() => setShowCancelModal(false)}>
              Volver
            </Button>
          </div>
        }
      />
      <Sheet
        open={showEnd}
        onClose={() => setShowEnd(false)}
        title="Quitar la clase a partir de un día"
        description="La clase deja de darse después de ese día. Todo lo anterior (clases dadas, reservas, faltas, horas del monitor) se queda como estaba."
        footer={
          <div className="flex w-full flex-col gap-2">
            <Button size="lg" variant="danger" onClick={handleEnd} loading={ending} disabled={!endLastDay}>
              Quitar la clase {endLastDay ? `después del ${fmt(endLastDay)}` : ''}
            </Button>
            <Button variant="ghost" onClick={() => setShowEnd(false)}>Volver</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Último día de clase">
            <Select value={endWhen} onChange={(e) => setEndWhen(e.target.value as 'month_end' | 'other')}>
              <option value="month_end">Final de este mes ({fmt(monthEnd)})</option>
              <option value="other">Otro día…</option>
            </Select>
          </Field>
          {endWhen === 'other' && (
            <Field label="Fecha">
              <Input type="date" min={dayBefore(today)} value={endOther} onChange={(e) => setEndOther(e.target.value)} />
            </Field>
          )}
          <ul className="list-disc space-y-1 pl-5 text-meta text-ink-2">
            <li>Las reservas de días posteriores se anulan y se devuelve la clase a la bolsa de cada alumno.</li>
            {fixedStudents.length > 0 ? (
              <li>
                Los {fixedStudents.length} alumnos fijos salen del grupo ese día ({fixedStudents.join(', ')}). Si es su único grupo, se les da de baja.
                {' '}Si quieres que sigan en otra clase, antes cámbialos con <strong>Cambiar de grupo</strong> (con fecha) en la lista de abajo.
              </li>
            ) : (
              <li>No hay alumnos fijos en el grupo.</li>
            )}
          </ul>
        </div>
      </Sheet>
    </>
  )
}
