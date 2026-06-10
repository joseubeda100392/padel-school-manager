'use client'

import { useState } from 'react'

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
const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-brand-100 text-brand-600',
  cancelled: 'bg-gray-100 text-gray-500',
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
    <div className="rounded-xl bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">Recuperaciones</h2>
        <p className="text-xs text-gray-400">{makeups.length} registradas · {makeups.filter(m => m.status === 'pending').length} pendientes</p>
      </div>
      <ul className="divide-y divide-gray-50">
        {makeups.map((m) => {
          const dow = m.schedule?.start_time ? new Date(m.schedule.start_time).getDay() : null
          const time = m.schedule?.start_time
            ? new Date(m.schedule.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            : null
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {dow !== null ? `${DAYS[dow]} ${time}` : 'Clase sin horario'}
                </p>
                <p className="text-xs text-gray-400">
                  {m.original_date ? `Faltó: ${new Date(m.original_date).toLocaleDateString('es-ES')}` : 'Sin fecha origen'}
                  {m.makeup_date ? ` · Recupera: ${new Date(m.makeup_date).toLocaleDateString('es-ES')}` : ''}
                </p>
                {m.notes && <p className="text-xs italic text-gray-400">{m.notes}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[m.status]}`}>
                {statusLabel[m.status]}
              </span>
              {m.status === 'pending' && (
                <div className="flex gap-1">
                  <button onClick={() => handleStatus(m.id, 'completed')}
                    className="rounded border border-brand-200 px-2 py-1 text-xs text-brand-500 hover:bg-brand-50">
                    ✓ Realizada
                  </button>
                  <button onClick={() => handleStatus(m.id, 'cancelled')}
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-400 hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              )}
              {m.schedule?.id && (
                <a href={`/dashboard/schedule/${m.schedule.id}`}
                  className="shrink-0 text-xs font-medium text-brand-500 hover:underline">
                  Ver clase →
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
