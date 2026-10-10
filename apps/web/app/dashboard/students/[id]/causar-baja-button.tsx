'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { CalendarClock, UserMinus } from 'lucide-react'
import { StudentCombobox } from '@/components/student-combobox'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { Sheet } from '@/components/ui/sheet'

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
      <Notice
        tone="warn"
        icon={<CalendarClock />}
        className="w-full"
        action={
          <Button variant="secondary" size="sm" onClick={handleCancelarBaja} loading={loading}>
            Cancelar baja
          </Button>
        }
      >
        Baja programada para el <span className="tabular-nums">{new Date(pendingBajaDate).toLocaleDateString('es-ES')}</span>
      </Notice>
    )
  }

  return (
    <>
      <Button variant="danger-ghost" onClick={() => setOpen(true)} className="w-full border border-danger-ink/30 sm:w-auto">
        <UserMinus className="h-4 w-4" aria-hidden />
        Causar baja
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Causar baja"
        description="El alumno seguirá en sus clases hasta fin de mes y quedará inactivo el mes que viene."
        footer={
          <>
            <Button variant="secondary" size="lg" className="sm:h-11" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="sm:h-11"
              onClick={handleCausarBaja}
              loading={loading}
              disabled={hasSubstitute && !substituteId}
            >
              {loading ? 'Guardando baja' : 'Confirmar baja'}
            </Button>
          </>
        }
      >
        <label className="flex min-h-11 items-center gap-3 text-label text-ink">
          <input
            type="checkbox"
            checked={hasSubstitute}
            onChange={(e) => { setHasSubstitute(e.target.checked); if (!e.target.checked) setSubstituteId('') }}
            className="h-5 w-5 rounded border-line-strong accent-accent-ink"
          />
          Tiene sustituto
        </label>

        {hasSubstitute && (
          <div className="mt-3">
            <StudentCombobox
              students={availableStudents}
              value={substituteId}
              onChange={setSubstituteId}
              placeholder="Buscar sustituto"
            />
          </div>
        )}
      </Sheet>
    </>
  )
}
