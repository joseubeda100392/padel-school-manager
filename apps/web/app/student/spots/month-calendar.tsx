'use client'

import { useRouter } from 'next/navigation'

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

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
export function MonthCalendar({
  year,
  month0,
  basePath,
  eventCounts,
  selectedDate,
  onSelectDate,
  todayStr,
  maxYear,
  maxMonth0,
}: {
  year: number
  month0: number
  basePath: string
  eventCounts: Record<string, number>
  selectedDate: string | null
  onSelectDate: (date: string) => void
  todayStr: string
  maxYear: number
  maxMonth0: number
}) {
  const router = useRouter()
  const cells = getMonthGrid(year, month0)

  function go(y: number, m: number) {
    router.push(`${basePath}?month=${y}-${String(m + 1).padStart(2, '0')}`)
  }

  function prev() {
    if (month0 === 0) go(year - 1, 11)
    else go(year, month0 - 1)
  }

  const isAtMax = year === maxYear && month0 === maxMonth0
  function next() {
    if (isAtMax) return
    if (month0 === 11) go(year + 1, 0)
    else go(year, month0 + 1)
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prev} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
          ← Anterior
        </button>
        <span className="text-sm font-semibold capitalize text-gray-900">{MONTH_NAMES[month0]} {year}</span>
        <button
          onClick={next}
          disabled={isAtMax}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-400">
        {DAY_LETTERS.map(l => <div key={l} className="py-1">{l}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />
          const count = eventCounts[date] ?? 0
          const isToday = date === todayStr
          const isSelected = date === selectedDate
          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`relative aspect-square rounded-lg text-xs font-medium transition-colors ${
                isSelected ? 'bg-brand-500 text-white' : isToday ? 'bg-brand-50 text-brand-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {Number(date.slice(-2))}
              {count > 0 && (
                <span className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                  isSelected ? 'bg-white text-brand-600' : 'bg-orange-500 text-white'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
