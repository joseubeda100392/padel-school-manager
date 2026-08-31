'use client'

import { useRouter } from 'next/navigation'

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

// Genérico: basePath decide a qué pantalla navega, maxYear/maxMonth decide
// hasta qué mes se puede avanzar (distinto según la pantalla — en Pagos es
// el mes de facturación efectivo, en horas de monitores es el mes de
// calendario real, no se puede ver un mes que aún no ha pasado).
export function MonthNavigator({
  year,
  month,
  basePath,
  maxYear,
  maxMonth,
}: {
  year: number
  month: number
  basePath: string
  maxYear: number
  maxMonth: number
}) {
  const router = useRouter()

  function go(y: number, m: number) {
    router.push(`${basePath}?month=${y}-${String(m + 1).padStart(2, '0')}`)
  }

  function prev() {
    if (month === 0) go(year - 1, 11)
    else go(year, month - 1)
  }

  function next() {
    if (year > maxYear || (year === maxYear && month >= maxMonth)) return
    if (month === 11) go(year + 1, 0)
    else go(year, month + 1)
  }

  const isCurrentMonth = year === maxYear && month === maxMonth

  return (
    <div className="flex items-center gap-3">
      <button onClick={prev} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
        ← Anterior
      </button>
      <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
        {MONTHS[month]} {year}
      </span>
      <button
        onClick={next}
        disabled={isCurrentMonth}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Siguiente →
      </button>
    </div>
  )
}
