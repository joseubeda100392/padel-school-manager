'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { StudentCombobox } from '@/components/student-combobox'

interface Student {
  id: string
  name: string
  email: string
}

export function CausarBajaButton({
  studentId,
  hasFixedEnrollments,
  pendingBajaDate,
  availableStudents,
}: {
  studentId: string
  hasFixedEnrollments: boolean
  pendingBajaDate: string | null
  availableStudents: Student[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [hasSubstitute, setHasSubstitute] = useState(false)
  const [substituteId, setSubstituteId] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCausarBaja() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/students/${studentId}/causar-baja`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ substituteId: hasSubstitute && substituteId ? substituteId : null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo programar la baja')
        return
      }
      toast.success('Baja programada para el mes que viene')
      setOpen(false)
      setHasSubstitute(false)
      setSubstituteId('')
      router.refresh()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelarBaja() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/students/${studentId}/causar-baja`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo cancelar la baja')
        return
      }
      toast.success('Baja cancelada')
      router.refresh()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (!hasFixedEnrollments && !pendingBajaDate) return null

  if (pendingBajaDate) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
        <span>Baja programada para el {new Date(pendingBajaDate).toLocaleDateString('es-ES')}</span>
        <button
          onClick={handleCancelarBaja}
          disabled={loading}
          className="font-medium text-yellow-900 underline hover:no-underline disabled:opacity-50"
        >
          Cancelar baja
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Causar baja
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-1 font-semibold text-gray-900">Causar baja</h3>
            <p className="mb-4 text-sm text-gray-500">
              El alumno seguirá en sus clases hasta fin de mes y quedará inactivo el mes que viene.
            </p>

            <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={hasSubstitute}
                onChange={(e) => { setHasSubstitute(e.target.checked); if (!e.target.checked) setSubstituteId('') }}
                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
              />
              Tiene sustituto
            </label>

            {hasSubstitute && (
              <div className="mb-4">
                <StudentCombobox
                  students={availableStudents}
                  value={substituteId}
                  onChange={setSubstituteId}
                  placeholder="Buscar sustituto..."
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCausarBaja}
                disabled={loading || (hasSubstitute && !substituteId)}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
