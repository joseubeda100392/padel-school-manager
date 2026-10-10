'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, CircleCheck, CircleOff, Clock } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { List } from '@/components/ui/list'

interface Makeup {
  id: string
  original_date: string | null
  makeup_date: string | null
  status: string
  notes: string | null
  schedule: { id: string; start_time: string } | null
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const statusLabel: Record<string, string> = { pending: 'Pendiente', completed: 'Realizada', cancelled: 'Cancelada' }

function MakeupStatus({ status }: { status: string }) {
  const label = statusLabel[status] ?? status
  if (status === 'completed') return <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />{label}</Badge>
  if (status === 'pending') return <Badge tone="warn"><Clock className="h-3.5 w-3.5" aria-hidden />{label}</Badge>
  return <Badge tone="neutral"><CircleOff className="h-3.5 w-3.5" aria-hidden />{label}</Badge>
}

export function StudentMakeups({ initialMakeups }: { initialMakeups: Makeup[] }) {
  const [makeups, setMakeups] = useState(initialMakeups)

  async function handleStatus(id: string, status: string) {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.from('makeups').update({ status }).eq('id', id)
    setMakeups((prev) => prev.map((m) => m.id === id ? { ...m, status } : m))
  }

  if (!makeups.length) return null

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Recuperaciones"
        description={`${makeups.length} registradas · ${makeups.filter(m => m.status === 'pending').length} pendientes`}
      />
      <List className="mt-3">
        {makeups.map((m) => {
          const dow = m.schedule?.start_time ? new Date(m.schedule.start_time).getDay() : null
          const time = m.schedule?.start_time
            ? new Date(m.schedule.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            : null
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-label text-ink">
                  {dow !== null ? `${DAYS[dow]} ${time}` : 'Clase sin horario'}
                </p>
                <p className="text-meta tabular-nums text-ink-3">
                  {m.original_date ? `Faltó: ${new Date(m.original_date).toLocaleDateString('es-ES')}` : 'Sin fecha de origen'}
                  {m.makeup_date ? ` · Recupera: ${new Date(m.makeup_date).toLocaleDateString('es-ES')}` : ''}
                </p>
                {m.notes && <p className="text-meta italic text-ink-3">{m.notes}</p>}
              </div>
              <MakeupStatus status={m.status} />
              {m.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleStatus(m.id, 'completed')}>
                    <Check className="h-4 w-4" aria-hidden />
                    Marcar realizada
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleStatus(m.id, 'cancelled')}>
                    Cancelar
                  </Button>
                </div>
              )}
              {m.schedule?.id && (
                <Link
                  href={`/dashboard/schedule/${m.schedule.id}`}
                  className={buttonVariants({ variant: 'link', size: 'sm', className: 'min-h-11 shrink-0' })}
                >
                  Ver clase
                </Link>
              )}
            </li>
          )
        })}
      </List>
    </Card>
  )
}
