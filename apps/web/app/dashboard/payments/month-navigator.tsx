'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    <nav aria-label="Cambiar de mes" className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
      <Button variant="secondary" size="icon" onClick={prev} aria-label="Mes anterior">
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </Button>
      <span aria-live="polite" className="min-w-[10rem] text-center text-label capitalize text-ink">
        {MONTHS[month]} {year}
      </span>
      <Button variant="secondary" size="icon" onClick={next} disabled={isCurrentMonth} aria-label="Mes siguiente">
        <ChevronRight className="h-5 w-5" aria-hidden />
      </Button>
    </nav>
  )
}
