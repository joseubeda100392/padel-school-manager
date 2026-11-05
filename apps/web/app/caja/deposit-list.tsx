'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { useConfirm } from '@/components/ui/confirm'

interface DepositStudent { id: string; name: string; email: string; paid: boolean }

const MAX_ROWS = 30

// Fianzas del club: por defecto las que faltan; buscando, cualquier alumno.
export function DepositList({ students }: { students: DepositStudent[] }) {
  const confirm = useConfirm()
  const [list, setList] = useState(students)
  const [q, setQ] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const query = q.trim().toLowerCase()
  const pendingCount = list.filter((s) => !s.paid).length
  const shown = (query
    ? list.filter((s) => s.name?.toLowerCase().includes(query) || s.email?.toLowerCase().includes(query))
    : list.filter((s) => !s.paid)
  ).slice(0, MAX_ROWS)

  async function toggle(s: DepositStudent) {
    const paid = !s.paid
    if (!paid && !(await confirm({
      title: `¿Quitar la fianza de ${s.name}?`,
      description: 'Quedará como no pagada.',
      confirmLabel: 'Quitar fianza',
      destructive: true,
    }))) return
    setSavingId(s.id)
    try {
      const res = await fetch('/api/caja/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: s.id, paid }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'No se pudo guardar la fianza')
        return
      }
      setList((prev) => prev.map((x) => x.id === s.id ? { ...x, paid } : x))
      toast.success(paid ? `Fianza de ${s.name} pagada` : `Fianza de ${s.name} quitada`)
    } catch {
      toast.error('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <div className="px-4 py-3 sm:px-5">
        <label htmlFor="deposit-search" className="sr-only">Buscar alumno</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input id="deposit-search" type="search" placeholder="Buscar alumno" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <p className="mt-2 text-meta text-ink-3">
          {query ? 'Resultados de la búsqueda' : `${pendingCount} alumno${pendingCount !== 1 ? 's' : ''} sin fianza pagada`}
        </p>
      </div>
      {shown.length === 0 ? (
        <p className="px-4 pb-4 text-body text-ink-2 sm:px-5">{query ? 'No hay alumnos con ese nombre.' : 'Todos tienen la fianza pagada.'}</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {shown.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-medium text-ink">{s.name}</p>
                <p className="truncate text-meta text-ink-3">{s.email}</p>
              </div>
              <Badge tone={s.paid ? 'success' : 'warn'}>{s.paid ? 'Fianza pagada' : 'Sin fianza'}</Badge>
              <Button
                variant={s.paid ? 'ghost' : 'secondary'}
                size="sm"
                loading={savingId === s.id}
                onClick={() => toggle(s)}
                aria-label={s.paid ? `Quitar fianza de ${s.name}` : `Marcar fianza pagada de ${s.name}`}
              >
                {s.paid ? 'Quitar' : 'Marcar pagada'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
