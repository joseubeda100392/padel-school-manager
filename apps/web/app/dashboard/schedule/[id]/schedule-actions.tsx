'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function ScheduleActions({ scheduleId }: { scheduleId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('¿Eliminar esta clase? Se eliminarán también todas las reservas asociadas.')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('bookings').delete().eq('schedule_id', scheduleId)
    await supabase.from('schedules').delete().eq('id', scheduleId)
    router.push('/dashboard/schedule')
  }

  return (
    <div className="flex gap-2">
      <a
        href={`/dashboard/schedule/${scheduleId}/edit`}
        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        Editar
      </a>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
      >
        {deleting ? 'Eliminando...' : 'Eliminar'}
      </button>
    </div>
  )
}
