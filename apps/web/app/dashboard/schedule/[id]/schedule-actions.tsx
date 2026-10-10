'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { useConfirm } from '@/components/ui/confirm'

export function ScheduleActions({ scheduleId, nextDate }: { scheduleId: string; nextDate: string }) {
  const confirm = useConfirm()
  const [deleting, setDeleting] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelMsg, setCancelMsg] = useState('')

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
      toast.error(`No se pudo eliminar la clase: ${json.error ?? res.statusText}`)
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
    </>
  )
}
