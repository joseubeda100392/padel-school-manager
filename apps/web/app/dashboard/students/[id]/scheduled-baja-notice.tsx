'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'

interface Group {
  id: string
  label: string
  endDate: string | null
}

const formatDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-ES')

// Va arriba de la ficha: una baja programada se tiene que ver al entrar, no
// al final de la página.
export function ScheduledBajaNotice({ studentId, groups }: { studentId: string; groups: Group[] }) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const scheduled = groups.filter(g => g.endDate)

  async function handleCancelarBaja(enrollmentId: string) {
    setLoadingId(enrollmentId)
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
      toast.success('Baja cancelada: sigue en el grupo')
      router.refresh()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoadingId(null)
    }
  }

  if (!scheduled.length) return null

  return (
    <Notice tone="warn" icon={<CalendarClock />}>
      <p className="font-medium">Baja programada</p>
      <ul className="mt-2 space-y-2">
        {scheduled.map(g => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {g.label} · deja el grupo el <span className="tabular-nums">{formatDay(g.endDate!)}</span>
            </span>
            <Button variant="secondary" size="sm" onClick={() => handleCancelarBaja(g.id)} loading={loadingId === g.id} disabled={!!loadingId}>
              Cancelar baja
            </Button>
          </li>
        ))}
      </ul>
    </Notice>
  )
}
