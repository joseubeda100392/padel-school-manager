'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/field'

export interface FaqItem {
  q: string
  a: string
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Preguntas frecuentes con buscador: filtra por cualquier palabra de la
// pregunta o la respuesta, sin importar tildes ni mayúsculas.
export function FaqSearch({ items }: { items: FaqItem[] }) {
  const [query, setQuery] = useState('')
  const words = normalize(query).split(/\s+/).filter(w => w.length > 1)
  const shown = useMemo(
    () => (words.length ? items.filter(i => words.every(w => normalize(`${i.q} ${i.a}`).includes(w))) : items),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- words sale de query
    [items, query],
  )

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Busca tu duda: pagar, instalar, recuperar…"
          aria-label="Buscar en las preguntas frecuentes"
          className="pl-9"
        />
      </div>
      {shown.length === 0 ? (
        <p className="text-body text-ink-3">No hay ninguna pregunta con esas palabras. Prueba con otras o escribe al club.</p>
      ) : (
        <div className="space-y-4">
          {shown.map(i => (
            <div key={i.q}>
              <p className="text-label text-ink">{i.q}</p>
              <p className="mt-1 text-body text-ink-2">{i.a}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
