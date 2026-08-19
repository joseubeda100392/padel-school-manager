'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { formatTime, getDayOfWeek } from '@/lib/utils'

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
// JS getDay: 0=Dom,1=Lun... → map to our index (Mon=0)
const JS_DAY_TO_IDX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 }

export default function MasterWeeklyCalendar({ schedules, readOnly = false }: { schedules: any[]; readOnly?: boolean }) {
  const router = useRouter()

  const byDay = useMemo(() => {
    const map: Record<number, any[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    schedules.forEach((s) => {
      const idx = JS_DAY_TO_IDX[getDayOfWeek(s.start_time)]
      if (idx !== undefined) map[idx].push(s)
    })
    for (const idx of Object.keys(map)) {
      map[Number(idx)].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    }
    return map
  }, [schedules])

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[900px] grid-cols-7 gap-2">
        {DAY_NAMES.map((dayName, idx) => {
          const classes = byDay[idx]
          return (
            <div key={idx}>
              <div className="mb-2 rounded-lg bg-gray-100 px-2 py-2 text-center">
                <p className="text-xs font-semibold text-gray-600">{dayName}</p>
              </div>

              <div className="space-y-2">
                {classes.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 px-2 py-4 text-center">
                    <p className="text-xs text-gray-300">Sin clases</p>
                  </div>
                )}
                {classes.map((s: any) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={readOnly ? undefined : () => router.push(`/dashboard/schedule/${s.id}?from=master`)}
                    disabled={readOnly}
                    className={`w-full rounded-lg bg-white p-2 text-left shadow-sm transition-all ${readOnly ? 'cursor-default' : 'hover:ring-green-400'} ${s.students?.length ? 'ring-1 ring-orange-300' : 'ring-1 ring-gray-100'}`}
                  >
                    <p className="text-[11px] font-medium text-gray-500">
                      {formatTime(s.start_time)} – {formatTime(s.end_time)}
                    </p>
                    <p className="text-xs font-semibold text-gray-900 truncate">{s.coach?.name ?? '—'}</p>
                    {(s.level?.description || s.level?.name) && (
                      <span
                        className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: s.level.color ?? '#6366f1' }}
                      >
                        {s.level.description || s.level.name}
                      </span>
                    )}
                    {s.students?.length > 0 && (
                      <div className="mt-1.5 divide-y divide-gray-100 border-t border-gray-100">
                        {s.students.map((name: string, i: number) => (
                          <p key={i} className="py-1 text-[11px] text-gray-600">{name}</p>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
