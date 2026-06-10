'use client'

import { useState, useRef, useEffect } from 'react'

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
    <div ref={ref} className="relative flex-1 min-w-[200px]">
      <div
        className="flex items-center rounded-lg border border-gray-200 bg-white focus-within:border-brand-500"
        onClick={() => setOpen(true)}
      >
        {selected && !open ? (
          <div className="flex flex-1 items-center justify-between px-3 py-2">
            <div>
              <p className="text-sm font-medium text-gray-900 leading-tight">{selected.name}</p>
              <p className="text-xs text-gray-400">{selected.email}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); clear() }}
              className="ml-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none bg-transparent"
          />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-400">Sin resultados.</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                onMouseDown={() => select(s)}
                className="w-full px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <p className="text-sm font-medium text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-400">{s.email}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
