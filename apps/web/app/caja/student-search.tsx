'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Search } from 'lucide-react'
import { Input } from '@/components/ui/field'

interface Student { id: string; name: string; email: string | null; phone: string | null }

const MAX_RESULTS = 8

// Buscar a cualquier alumno del club para ver sus cuotas, su fianza y sus pagos.
export function StudentSearch({ students }: { students: Student[] }) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const results = query.length < 2 ? [] : students
    .filter((s) => s.name.toLowerCase().includes(query) || s.email?.toLowerCase().includes(query) || s.phone?.replace(/\s/g, '').includes(query.replace(/\s/g, '')))
    .slice(0, MAX_RESULTS)

  return (
    <div className="px-4 py-3 sm:px-5">
      <label htmlFor="caja-student-search" className="sr-only">Buscar alumno</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input id="caja-student-search" type="search" placeholder="Nombre, email o teléfono" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      {query.length >= 2 && (
        results.length === 0 ? (
          <p className="mt-3 text-body text-ink-2">No hay alumnos con ese nombre.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {results.map((s) => (
              <li key={s.id}>
                <Link href={`/caja/alumno/${s.id}`} className="flex min-h-11 items-center gap-3 py-2 hover:bg-ink/[0.03]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium text-ink">{s.name}</span>
                    <span className="block truncate text-meta text-ink-3">{[s.phone, s.email].filter(Boolean).join(' · ')}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
