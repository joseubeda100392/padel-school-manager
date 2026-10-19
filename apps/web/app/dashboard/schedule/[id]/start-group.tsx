'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Hourglass } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'
import { useConfirm } from '@/components/ui/confirm'

// Aviso de "grupo en formación" con el botón para arrancarlo.
export function StartGroup({ scheduleId, interested, maxStudents, defaultDate }: { scheduleId: string; interested: number; maxStudents: number; defaultDate: string }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [date, setDate] = useState(defaultDate)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

  async function start() {
    const label = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    const ok = await confirm({
      title: '¿Arrancar el grupo?',
      description: `Los ${interested} interesados pasan a ser alumnos del grupo desde el ${label}: desde ese día la ven en su app y se les cobra la cuota. La clase deja de estar en formación.`,
      confirmLabel: 'Arrancar grupo',
    })
    if (!ok) return
    setBusy(true)
    setError('')
    const res = await fetch(`/api/admin/schedules/${scheduleId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: date }),
    }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    if (res?.ok) {
      toast.success(`Grupo en marcha con ${json.students} alumno${json.students === 1 ? '' : 's'}`)
      router.refresh()
    } else {
      setError(json.error ?? 'Error de conexión. Inténtalo de nuevo.')
    }
    setBusy(false)
  }

  return (
    <Notice tone="warn" icon={<Hourglass />}>
      <p className="font-semibold text-ink">Grupo en formación · {interested}/{maxStudents} interesados</p>
      <p className="mt-0.5">Los alumnos no lo ven ni pagan hasta que lo arranques. Cuando esté listo, elige desde qué día empieza.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Field label="Empieza el" className="w-full sm:w-48">
          <Input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} />
        </Field>
        <Button onClick={start} loading={busy} disabled={!date || interested === 0} className="w-full sm:w-auto">Arrancar grupo</Button>
      </div>
      {interested === 0 && <p className="mt-2 text-meta">Apunta al menos un interesado para poder arrancarlo.</p>}
      {error && <p role="alert" className="mt-2 text-meta font-medium text-danger-ink">{error}</p>}
    </Notice>
  )
}
