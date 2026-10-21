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

interface Group {
  id: string
  label: string
  endDate: string | null
}

const formatDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-ES')

// Baja para el mes que viene. Con varios grupos se elige de cuáles se va: el
// alumno sigue en los demás y solo queda inactivo si no le queda ninguno.
export function CausarBajaButton({
  studentId,
  groups,
  availableStudents,
}: {
  studentId: string
  groups: Group[]
  availableStudents: Student[]
}) {
  const router = useRouter()
  const scheduled = groups.filter(g => g.endDate)
  const open = groups.filter(g => !g.endDate)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [hasSubstitute, setHasSubstitute] = useState(false)
  const [substituteId, setSubstituteId] = useState('')
  const [loading, setLoading] = useState(false)

  const chosen = open.length === 1 ? [open[0].id] : selected
  const keeps = groups.filter(g => !g.endDate && !chosen.includes(g.id))

  function openSheet() {
    setSelected([])
    setHasSubstitute(false)
    setSubstituteId('')
    setSheetOpen(true)
  }

  async function handleCausarBaja() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/students/${studentId}/causar-baja`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentIds: chosen, substituteId: hasSubstitute && substituteId ? substituteId : null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo programar la baja')
        return
      }
      toast.success(chosen.length === 1 && groups.length > 1 ? 'Baja de ese grupo programada para el mes que viene' : 'Baja programada para el mes que viene')
      setSheetOpen(false)
      router.refresh()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelarBaja(enrollmentId: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/students/${studentId}/causar-baja`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId }),
      })
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

  if (!groups.length) return null

  return (
    <div className="flex w-full flex-col gap-3 sm:items-end">
      {scheduled.length > 0 && (
        <Notice tone="warn" icon={<CalendarClock />} className="w-full">
          <p className="font-medium">Baja programada</p>
          <ul className="mt-2 space-y-2">
            {scheduled.map(g => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {g.label} · deja el grupo el <span className="tabular-nums">{formatDay(g.endDate!)}</span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => handleCancelarBaja(g.id)} loading={loading}>
                  Cancelar baja
                </Button>
              </li>
            ))}
          </ul>
        </Notice>
      )}

      {open.length > 0 && (
        <Button variant="danger-ghost" onClick={openSheet} className="w-full border border-danger-ink/30 sm:w-auto">
          <UserMinus className="h-4 w-4" aria-hidden />
          {scheduled.length > 0 ? 'Causar baja de otro grupo' : 'Causar baja'}
        </Button>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Causar baja"
        description="Sigue en clase hasta fin de mes y deja los grupos elegidos el mes que viene."
        footer={
          <>
            <Button variant="secondary" size="lg" className="sm:h-11" onClick={() => setSheetOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="sm:h-11"
              onClick={handleCausarBaja}
              loading={loading}
              disabled={!chosen.length || (hasSubstitute && !substituteId)}
            >
              {loading ? 'Guardando baja' : 'Confirmar baja'}
            </Button>
          </>
        }
      >
        {open.length > 1 ? (
          <fieldset className="space-y-1">
            <legend className="mb-2 text-label text-ink">¿De qué grupos se da de baja?</legend>
            {open.map(g => (
              <label key={g.id} className="flex min-h-11 items-center gap-3 text-body text-ink">
                <input
                  type="checkbox"
                  checked={selected.includes(g.id)}
                  onChange={e => setSelected(s => (e.target.checked ? [...s, g.id] : s.filter(id => id !== g.id)))}
                  className="h-5 w-5 rounded border-line-strong accent-accent-ink"
                />
                {g.label}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="text-body text-ink">Deja el grupo <strong>{open[0]?.label}</strong>.</p>
        )}

        {chosen.length > 0 && (
          <Notice tone={keeps.length ? 'neutral' : 'warn'} className="mt-3">
            {keeps.length
              ? `Sigue en ${keeps.map(g => g.label).join(', ')} y no se desactiva.`
              : 'Se queda sin grupos: el mes que viene quedará inactivo.'}
          </Notice>
        )}

        <label className="mt-3 flex min-h-11 items-center gap-3 text-label text-ink">
          <input
            type="checkbox"
            checked={hasSubstitute}
            onChange={(e) => { setHasSubstitute(e.target.checked); if (!e.target.checked) setSubstituteId('') }}
            className="h-5 w-5 rounded border-line-strong accent-accent-ink"
          />
          Tiene sustituto {chosen.length > 1 ? '(entra en todos los grupos que deja)' : ''}
        </label>

        {hasSubstitute && (
          <div className="mt-3">
            <StudentCombobox
              students={availableStudents}
              value={substituteId}
              onChange={setSubstituteId}
              placeholder="Buscar sustituto"
              inline
            />
          </div>
        )}
      </Sheet>
    </div>
  )
}
