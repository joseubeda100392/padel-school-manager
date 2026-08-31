'use client'

import { useRouter } from 'next/navigation'
import { currentBillingMonth } from '@/lib/billing-cycle'

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

  // "Mes actual" aquí es el mes de facturación efectivo, no el de calendario
  // — a menos de 5 días de fin de mes ya se considera el mes siguiente (ver
  // currentBillingMonth), si no "Siguiente" se queda bloqueado justo al
  // llegar al mes que realmente toca ver.
  const billing = currentBillingMonth()

  function next() {
    if (year > billing.year || (year === billing.year && month >= billing.month0)) return
    if (month === 11) go(year + 1, 0)
    else go(year, month + 1)
  }

  const isCurrentMonth = year === billing.year && month === billing.month0

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
