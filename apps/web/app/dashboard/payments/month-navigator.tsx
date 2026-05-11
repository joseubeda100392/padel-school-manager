'use client'

import { useRouter } from 'next/navigation'

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export function MonthNavigator({ year, month }: { year: number; month: number }) {
  const router = useRouter()

  function go(y: number, m: number) {
    router.push(`/dashboard/payments?month=${y}-${String(m + 1).padStart(2, '0')}`)
  }

  function prev() {
    if (month === 0) go(year - 1, 11)
    else go(year, month - 1)
  }

  function next() {
    const now = new Date()
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) return
    if (month === 11) go(year + 1, 0)
    else go(year, month + 1)
  }

  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

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
