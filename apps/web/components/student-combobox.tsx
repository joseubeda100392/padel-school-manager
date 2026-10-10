'use client'

import { X } from 'lucide-react'

import { useId, useState, useRef, useEffect } from 'react'

interface Student {
  id: string
  name: string
  email: string
}

interface Props {
  students: Student[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

export function StudentCombobox({ students, value, onChange, placeholder = 'Buscar alumno...' }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const listId = useId()
  const ref = useRef<HTMLDivElement>(null)

  const selected = students.find((s) => s.id === value)

  const filtered = query.trim()
    ? students.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.email.toLowerCase().includes(query.toLowerCase())
      )
    : students

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(s: Student) {
    onChange(s.id)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    onChange('')
    setQuery('')
  }

  return (
    <div ref={ref} className="relative min-w-[200px] flex-1">
      <div
        className="flex min-h-11 items-center rounded-control border border-line-strong/70 bg-surface transition-[border-color,box-shadow] focus-within:border-accent-ink focus-within:ring-2 focus-within:ring-accent/30"
        onClick={() => setOpen(true)}
      >
        {selected && !open ? (
          <div className="flex flex-1 items-center justify-between gap-2 py-1.5 pl-3.5 pr-1">
            <div className="min-w-0">
              <p className="truncate text-body font-medium leading-tight text-ink">{selected.name}</p>
              <p className="truncate text-meta text-ink-3">{selected.email}</p>
            </div>
            <button
              type="button"
              aria-label={`Quitar a ${selected.name}`}
              onClick={(e) => { e.stopPropagation(); clear() }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full bg-transparent px-3.5 py-2 text-base text-ink outline-none placeholder:text-ink-3/80 sm:text-body"
          />
        )}
      </div>

      {open && (
        <div id={listId} role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-control border border-line bg-surface shadow-overlay">
          {filtered.length === 0 ? (
            <p className="px-3.5 py-3 text-body text-ink-3">Ningún alumno coincide con la búsqueda.</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={selected?.id === s.id}
                onMouseDown={() => select(s)}
                className="w-full border-b border-line px-3.5 py-2.5 text-left last:border-0 hover:bg-ink/[0.03]"
              >
                <p className="text-body font-medium text-ink">{s.name}</p>
                <p className="text-meta text-ink-3">{s.email}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
