'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DAY_LETTERS = [
  { short: 'L', name: 'lunes' },
  { short: 'M', name: 'martes' },
  { short: 'X', name: 'miércoles' },
  { short: 'J', name: 'jueves' },
  { short: 'V', name: 'viernes' },
  { short: 'S', name: 'sábado' },
  { short: 'D', name: 'domingo' },
]

// Rejilla de un mes, lunes-domingo, con huecos null para completar la primera
// y la última semana.
function getMonthGrid(year: number, month0: number): (string | null)[] {
  const first = new Date(year, month0, 1)
  const startWeekday = (first.getDay() + 6) % 7 // 0=Lun..6=Dom
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// Componente puro: solo pinta la rejilla y avisa de selección/navegación —
// no sabe nada de huecos libres, faltas, ni de ningún otro dato de negocio.
// Navegación: si se pasa `onNavigate`, cambia de mes en estado local; si no,
// navega por URL con `basePath` + `?month=` (calendario que controla la página).
export function MonthCalendar({
  year,
  month0,
  basePath,
  onNavigate,
  eventCounts,
  selectedDate,
  onSelectDate,
  todayStr,
  maxYear,
  maxMonth0,
  minYear,
  minMonth0,
  eventLabel = ['clase', 'clases'],
  legend,
}: {
  year: number
  month0: number
  basePath?: string
  onNavigate?: (year: number, month0: number) => void
  eventCounts: Record<string, number>
  selectedDate: string | null
  onSelectDate: (date: string) => void
  todayStr: string
  maxYear: number
  maxMonth0: number
  minYear?: number
  minMonth0?: number
  /** Singular y plural de lo que marca el punto, para lectores de pantalla y la leyenda. */
  eventLabel?: [string, string]
  /** Texto de la leyenda bajo la rejilla. */
  legend?: string
}) {
  const router = useRouter()
  const cells = getMonthGrid(year, month0)

  function go(y: number, m: number) {
    if (onNavigate) onNavigate(y, m)
    else if (basePath) router.push(`${basePath}?month=${y}-${String(m + 1).padStart(2, '0')}`, { scroll: false })
  }

  const isAtMin = minYear !== undefined && minMonth0 !== undefined && (year < minYear || (year === minYear && month0 <= minMonth0))
  const isAtMax = year > maxYear || (year === maxYear && month0 >= maxMonth0)

  function prev() {
    if (isAtMin) return
    if (month0 === 0) go(year - 1, 11)
    else go(year, month0 - 1)
  }

  function next() {
    if (isAtMax) return
    if (month0 === 11) go(year + 1, 0)
    else go(year, month0 + 1)
  }

  const monthTitle = `${MONTH_NAMES[month0].charAt(0).toUpperCase()}${MONTH_NAMES[month0].slice(1)} ${year}`

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-heading text-ink" aria-live="polite">{monthTitle}</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={prev}
            disabled={isAtMin}
            aria-label="Mes anterior"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-ink/5 disabled:text-ink/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            disabled={isAtMax}
            aria-label="Mes siguiente"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-ink/5 disabled:text-ink/20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line pb-1.5 text-center text-meta font-medium text-ink-3">
        {DAY_LETTERS.map((d) => (
          <abbr key={d.short} title={d.name} className="no-underline">{d.short}</abbr>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-y-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} aria-hidden />
          const count = eventCounts[date] ?? 0
          const isToday = date === todayStr
          const isPast = date < todayStr
          const isSelected = date === selectedDate
          const day = Number(date.slice(-2))
          const label = `${day} de ${MONTH_NAMES[month0]}${count ? `, ${count} ${count === 1 ? eventLabel[0] : eventLabel[1]}` : ''}${isToday ? ', hoy' : ''}`
          return (
            <div key={date} className="flex justify-center">
              <button
                type="button"
                onClick={() => onSelectDate(date)}
                aria-label={label}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                className={cn(
                  'relative flex h-11 w-11 flex-col items-center justify-center rounded-full text-body tabular-nums transition-colors duration-150',
                  isSelected
                    ? 'bg-chrome font-semibold text-white'
                    : count > 0
                      ? 'font-semibold text-ink hover:bg-ink/5'
                      : isPast
                        ? 'text-ink-3/70 hover:bg-ink/5'
                        : 'text-ink-2 hover:bg-ink/5',
                  isToday && !isSelected && 'ring-1 ring-inset ring-line-strong',
                )}
              >
                {day}
                {count > 0 && (
                  <span aria-hidden className="absolute bottom-1.5 flex gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }, (_, k) => (
                      <span key={k} className={cn('h-1 w-1 rounded-full', isSelected ? 'bg-accent' : 'bg-accent-ink')} />
                    ))}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {legend && (
        <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-meta text-ink-3">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-ink" />
          {legend}
        </p>
      )}
    </div>
  )
}
