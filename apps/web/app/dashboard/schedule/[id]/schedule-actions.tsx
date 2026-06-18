'use client'

import { useState } from 'react'

export function ScheduleActions({ scheduleId, nextDate }: { scheduleId: string; nextDate: string }) {
  const [deleting, setDeleting] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelMsg, setCancelMsg] = useState('')

  async function handleDelete() {
    if (!confirm('¿Eliminar esta clase? Se eliminarán también todas las reservas asociadas.')) return
    setDeleting(true)
    await fetch('/api/admin/schedules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId }),
    })
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
      <div className="flex flex-wrap gap-2">
        <a
          href={`/dashboard/schedule/${scheduleId}/edit`}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Editar
        </a>
        <button
          onClick={() => setShowCancelModal(true)}
          className="rounded-lg bg-orange-50 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-100"
        >
          Cancelar sesión
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
        >
          {deleting ? 'Eliminando...' : 'Eliminar clase'}
        </button>
      </div>

      {cancelMsg && (
        <p className="mt-2 text-sm text-brand-600">{cancelMsg}</p>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Cancelar sesión</h3>
            <p className="mt-2 text-sm text-gray-500">
              ¿Por qué cancelas esta sesión? Esto determina si los alumnos recuperan la clase en su bolsa.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <button
                onClick={() => handleCancelSession(true)}
                disabled={cancelling}
                className="rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                La clase no se da → +1 bolsa a cada alumno
              </button>
              <button
                onClick={() => handleCancelSession(false)}
                disabled={cancelling}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Error al crear la clase → sin crédito a bolsas
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
