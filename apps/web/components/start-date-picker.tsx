'use client'

import { useState } from 'react'
import { Input, Select } from '@/components/ui/field'
import { firstOfNextMonth, madridToday } from '@/lib/enrollment-window'

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

// "Desde cuándo" de un alta o un cambio de grupo. value '' = desde hoy.
export function StartDatePicker({
  value,
  onChange,
  todayLabel = 'Desde hoy',
}: {
  value: string
  onChange: (date: string) => void
  todayLabel?: string
}) {
  const today = madridToday()
  const nextMonth = firstOfNextMonth(today)
  const [custom, setCustom] = useState(!!value && value !== nextMonth)
  const mode = custom ? 'other' : value === nextMonth ? 'next' : 'today'

  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
      <Select
        aria-label="Desde cuándo"
        value={mode}
        onChange={e => {
          const v = e.target.value
          setCustom(v === 'other')
          onChange(v === 'next' ? nextMonth : v === 'other' ? nextMonth : '')
        }}
        className="w-full sm:w-auto"
      >
        <option value="today">{todayLabel}</option>
        <option value="next">Desde el 1 de {MONTHS[Number(nextMonth.slice(5, 7)) - 1]}</option>
        <option value="other">Otra fecha…</option>
      </Select>
      {custom && (
        <Input
          type="date"
          aria-label="Fecha de entrada"
          min={today}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full sm:w-44"
        />
      )}
    </div>
  )
}
