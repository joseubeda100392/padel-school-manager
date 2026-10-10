'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useMemo, useDeferredValue, useCallback, memo } from 'react'
import { Check, CircleCheck, CircleOff, Download, Search, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/feedback'
import { Avatar, List, ListRow } from '@/components/ui/list'

const roleLabel: Record<string, string> = {
  student: 'Alumno',
  coach: 'Monitor',
  admin: 'Admin',
}

type EnrollmentSummary = { total: number; id: string | null }

interface Props {
  students: any[]
  levelMap: Record<string, any>
  enrollmentMap: Record<string, EnrollmentSummary>
  defaultTab?: string
}

const TABS = [
  { value: '', label: 'Todos' },
  { value: 'student', label: 'Alumnos' },
  { value: 'coach', label: 'Monitores' },
  { value: 'admin', label: 'Admins' },
]

export default function StudentsTable({ students, levelMap, enrollmentMap, defaultTab = 'student' }: Props) {
  const [q, setQ] = useState('')
  const [role, setRole] = useState(defaultTab)
  const [status, setStatus] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [editingCuotaId, setEditingCuotaId] = useState<string | null>(null)
  const [editingCuotaValue, setEditingCuotaValue] = useState('')
  const [savingCuota, setSavingCuota] = useState(false)
  const [localCuotas, setLocalCuotas] = useState<Record<string, number>>({})

  const countByRole = useMemo(() => {
    const counts: Record<string, number> = { '': students.length }
    for (const s of students) counts[s.role] = (counts[s.role] ?? 0) + 1
    return counts
  }, [students])

  function exportCSV() {
    const headers = ['Nombre', 'Email', 'Rol', 'Estado', 'Teléfono', 'Alta', 'Baja']
    const rows = filtered.map((s) => [
      s.name ?? '',
      s.email ?? '',
      roleLabel[s.role] ?? s.role,
      s.is_active ? 'Activo' : 'Inactivo',
      s.phone ?? '',
      formatDate(s.start_date ?? s.created_at),
      s.end_date ? formatDate(s.end_date) : '',
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'alumnos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const saveCuota = useCallback(async (enrollmentId: string, studentId: string, value: string) => {
    const euros = parseFloat(value)
    if (isNaN(euros) || euros < 0) return
    const cents = Math.round(euros * 100)
    setSavingCuota(true)
    const res = await fetch(`/api/group-enrollments/${enrollmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthly_price: cents }),
    })
    if (res.ok) {
      setLocalCuotas(prev => ({ ...prev, [studentId]: cents }))
    }
    setEditingCuotaId(null)
    setSavingCuota(false)
  }, [])

  const startEditCuota = useCallback((studentId: string, initialValue: string) => {
    setEditingCuotaId(studentId)
    setEditingCuotaValue(initialValue)
  }, [])

  const cancelEditCuota = useCallback(() => setEditingCuotaId(null), [])

  // useDeferredValue mantiene el input reactivo al instante mientras el
  // filtrado/repintado de las ~350 filas se procesa en segundo plano.
  const deferredQ = useDeferredValue(q)

  const filtered = useMemo(() => {
    const qLower = deferredQ.toLowerCase()
    return students.filter((s) => {
      const matchQ = !deferredQ || (s.name ?? '').toLowerCase().includes(qLower) || (s.email ?? '').toLowerCase().includes(qLower)
      const matchRole = !role || s.role === role
      const matchStatus = status === '' || (status === 'active' ? s.is_active : !s.is_active)
      const matchLevel = !levelFilter || (
        levelFilter === 'none'
          ? !s.current_level_id
          : s.current_level_id === levelFilter
      )
      return matchQ && matchRole && matchStatus && matchLevel
    })
  }, [students, deferredQ, role, status, levelFilter])

  const isStudentTab = role === 'student'
  const hasFilters = !!(q || role || status || levelFilter)

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filtrar por rol" className="flex gap-1 overflow-x-auto rounded-control border border-line bg-surface-2 p-1">
        {TABS.map((tab) => {
          const active = role === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() => setRole(tab.value)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] px-4 text-label transition-colors sm:flex-none ${
                active ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 text-meta tabular-nums ${active ? 'bg-accent-soft text-accent-ink' : 'bg-ink/[0.06] text-ink-2'}`}>
                {countByRole[tab.value] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <label htmlFor="students-search" className="sr-only">Buscar por nombre o email</label>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input
            id="students-search"
            type="search"
            placeholder="Buscar por nombre o email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10"
          />
        </div>
        <Field label="Estado" className="w-full sm:w-auto">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </Select>
        </Field>
        {(role === 'student' || role === '') && (
          <Field label="Nivel" className="w-full sm:w-auto">
            <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
              <option value="">Todos los niveles</option>
              <option value="none">Sin asignar</option>
              {Object.values(levelMap).map((l: any) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </Field>
        )}
        {hasFilters && (
          <Button variant="ghost" onClick={() => { setQ(''); setRole(''); setStatus(''); setLevelFilter('') }}>
            <X className="h-4 w-4" aria-hidden />
            Limpiar filtros
          </Button>
        )}
        <Button variant="secondary" onClick={exportCSV}>
          <Download className="h-4 w-4" aria-hidden />
          Descargar CSV
        </Button>
      </div>

      <p className="text-meta tabular-nums text-ink-3" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'usuario' : 'usuarios'}
      </p>

      <Card className="overflow-hidden">
        {!filtered.length ? (
          <EmptyState
            icon={<Search />}
            title={hasFilters ? 'Sin resultados' : 'Aún no hay usuarios'}
            description={hasFilters ? 'Prueba con otra búsqueda o quita algún filtro.' : 'Crea el primero con el botón Nuevo usuario.'}
          />
        ) : (
          <>
            <List className="sm:hidden">
              {filtered.map((s) => {
                const level = s.current_level_id ? levelMap[s.current_level_id] : null
                return (
                  <ListRow
                    key={s.id}
                    href={`/dashboard/students/${s.id}`}
                    leading={<Avatar name={s.name ?? ''} />}
                    title={s.name}
                    subtitle={
                      <span className="flex flex-col gap-0.5">
                        <span className="truncate">{s.email}</span>
                        {s.role === 'student' ? (
                          level ? <LevelTag name={level.name} color={level.color} /> : <span>Sin nivel</span>
                        ) : (
                          <span>{roleLabel[s.role] ?? s.role}</span>
                        )}
                      </span>
                    }
                    trailing={<StatusBadge active={s.is_active} />}
                  />
                )
              })}
            </List>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[880px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-left text-meta font-medium text-ink-3">
                    <th scope="col" className="px-4 py-3">Nombre</th>
                    <th scope="col" className="px-4 py-3">Email</th>
                    <th scope="col" className="px-4 py-3">Teléfono</th>
                    <th scope="col" className="px-4 py-3">Rol</th>
                    {isStudentTab ? <th scope="col" className="px-4 py-3">Nivel</th> : null}
                    <th scope="col" className="px-4 py-3">Estado</th>
                    <th scope="col" className="px-4 py-3">Alta</th>
                    <th scope="col" className="px-4 py-3">Baja</th>
                    {isStudentTab ? <th scope="col" className="px-4 py-3 text-right">Cuota</th> : null}
                    {isStudentTab ? <th scope="col" className="px-4 py-3">Condiciones</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((s) => (
                    <StudentRow
                      key={s.id}
                      student={s}
                      level={s.current_level_id ? levelMap[s.current_level_id] : null}
                      enrollment={enrollmentMap[s.id]}
                      cuotaCents={s.id in localCuotas ? localCuotas[s.id] : enrollmentMap[s.id]?.total ?? null}
                      isStudentTab={isStudentTab}
                      isEditing={editingCuotaId === s.id}
                      editingValue={editingCuotaId === s.id ? editingCuotaValue : ''}
                      savingCuota={savingCuota}
                      onChangeCuotaValue={setEditingCuotaValue}
                      onStartEdit={startEditCuota}
                      onCancelEdit={cancelEditCuota}
                      onSave={saveCuota}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Activo</Badge>
  ) : (
    <Badge tone="neutral"><CircleOff className="h-3.5 w-3.5" aria-hidden />Inactivo</Badge>
  )
}

interface StudentRowProps {
  student: any
  level: any
  enrollment: EnrollmentSummary | undefined
  cuotaCents: number | null
  isStudentTab: boolean
  isEditing: boolean
  editingValue: string
  savingCuota: boolean
  onChangeCuotaValue: (value: string) => void
  onStartEdit: (studentId: string, initialValue: string) => void
  onCancelEdit: () => void
  onSave: (enrollmentId: string, studentId: string, value: string) => void
}

const StudentRow = memo(function StudentRow({
  student: s, level, enrollment, cuotaCents, isStudentTab, isEditing, editingValue, savingCuota,
  onChangeCuotaValue, onStartEdit, onCancelEdit, onSave,
}: StudentRowProps) {
  return (
    <tr className="hover:bg-ink/[0.03]">
      <td className="px-4 py-3">
        <Link href={`/dashboard/students/${s.id}`} className="flex items-center gap-3 text-label text-ink hover:text-accent-ink">
          {s.avatar_url ? (
            <Image src={s.avatar_url} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <Avatar name={s.name ?? ''} className="h-8 w-8 shrink-0 text-meta" />
          )}
          <span className="whitespace-nowrap">{s.name}</span>
        </Link>
      </td>
      <td className="px-4 py-3 text-body text-ink-2">{s.email}</td>
      <td className="whitespace-nowrap px-4 py-3 text-body tabular-nums text-ink-2">{s.phone || <span className="text-ink-3">—</span>}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <Badge tone="outline">{roleLabel[s.role] ?? s.role}</Badge>
          {s.role === 'coach' && s.also_student && <Badge tone="outline">También alumno</Badge>}
        </div>
      </td>
      {isStudentTab && (
        <td className="px-4 py-3">
          {s.role !== 'student' ? (
            <span className="text-ink-3">—</span>
          ) : level ? (
            <LevelTag name={level.name} color={level.color} />
          ) : (
            <span className="text-meta text-ink-3">Sin asignar</span>
          )}
        </td>
      )}
      <td className="px-4 py-3"><StatusBadge active={s.is_active} /></td>
      <td className="whitespace-nowrap px-4 py-3 text-body tabular-nums text-ink-2">{formatDate(s.start_date ?? s.created_at)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-body tabular-nums text-ink-2">{s.end_date ? formatDate(s.end_date) : '—'}</td>
      {isStudentTab && (
        <td className="px-4 py-3 text-right text-body">
          {s.role !== 'student' ? (
            <span className="text-ink-3">—</span>
          ) : cuotaCents === null ? (
            <span className="text-ink-3">—</span>
          ) : isEditing && enrollment?.id ? (
            <div className="flex items-center justify-end gap-1">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                aria-label={`Cuota mensual de ${s.name}`}
                value={editingValue}
                onChange={(e) => onChangeCuotaValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSave(enrollment.id!, s.id, editingValue)
                  if (e.key === 'Escape') onCancelEdit()
                }}
                className="w-24 tabular-nums"
                autoFocus
              />
              <Button size="icon" loading={savingCuota} aria-label="Guardar cuota" onClick={() => onSave(enrollment.id!, s.id, editingValue)}>
                <Check className="h-4 w-4" aria-hidden />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Cancelar edición" onClick={onCancelEdit}>
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (enrollment?.id) onStartEdit(s.id, (cuotaCents / 100).toFixed(2))
              }}
              className={`min-h-11 whitespace-nowrap text-label tabular-nums ${enrollment?.id ? 'cursor-pointer text-ink hover:text-accent-ink' : 'cursor-default text-ink-2'}`}
              title={enrollment?.id ? 'Pulsa para editar' : 'Varias matrículas: edita desde el perfil del alumno'}
            >
              {(cuotaCents / 100).toFixed(2)} €/mes{!enrollment?.id ? ' *' : ''}
            </button>
          )}
        </td>
      )}
      {isStudentTab && (
        <td className="px-4 py-3 text-body">
          {s.terms_accepted_at ? (
            <span className="inline-flex items-center gap-1 text-meta text-accent-ink" title={formatDate(s.terms_accepted_at)}>
              <CircleCheck className="h-4 w-4" aria-hidden />Aceptadas
            </span>
          ) : (
            <span className="text-ink-3">—</span>
          )}
        </td>
      )}
    </tr>
  )
})
