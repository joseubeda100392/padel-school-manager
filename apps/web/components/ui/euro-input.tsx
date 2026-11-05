'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/field'
import { centsToEurosText, eurosToCents } from '@/lib/money'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  cents: number
  onCents: (cents: number) => void
}

// Campo de euros: guarda lo que se escribe tal cual y solo avisa con un
// importe válido. Convertir en cada tecla rompía «46,» (salía NaN y el
// campo se quedaba bloqueado).
export function EuroInput({ cents, onCents, ...rest }: Props) {
  const [text, setText] = useState(() => (cents ? centsToEurosText(cents) : ''))
  const parsed = eurosToCents(text)

  // Si el importe cambia desde fuera (p. ej. al elegir una tarifa), se enseña.
  useEffect(() => {
    if ((parsed ?? 0) !== cents) setText(cents ? centsToEurosText(cents) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents])

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={text}
      aria-invalid={text.trim() !== '' && parsed === null ? true : rest['aria-invalid']}
      onChange={(ev) => {
        setText(ev.target.value)
        const next = eurosToCents(ev.target.value)
        onCents(next ?? 0)
      }}
    />
  )
}
