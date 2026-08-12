'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useMemo, useDeferredValue, useCallback, memo } from 'react'
import { formatDate } from '@/lib/utils'

const roleLabel: Record<string, string> = {
  student: 'Alumno',
  coach: 'Monitor',
  admin: 'Admin',
}

const roleBadge: Record<string, string> = {
  student: 'bg-blue-100 text-blue-700',
  coach: 'bg-purple-100 text-purple-700',
  admin: 'bg-brand-100 text-brand-600',
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
  const colSpanCount = isStudentTab ? 10 : 7

  return (
    <>
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setRole(tab.value)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              role === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${role === tab.value ? 'bg-brand-100 text-brand-600' : 'bg-gray-200 text-gray-500'}`}>
              {countByRole[tab.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        {(role === 'student' || role === '') && (
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">Todos los niveles</option>
            <option value="none">Sin asignar</option>
            {Object.values(levelMap).map((l: any) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
        {(q || role || status || levelFilter) && (
          <button
            onClick={() => { setQ(''); setRole(''); setStatus(''); setLevelFilter('') }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            Limpiar
          </button>
        )}
        <button
          onClick={exportCSV}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          ↓ CSV
        </button>
      </div>

      <p className="mb-3 text-sm text-gray-400">
        {filtered.length} {filtered.length === 1 ? 'usuario' : 'usuarios'}
      </p>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Teléfono</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Rol</th>
                {isStudentTab ? <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nivel</th> : null}
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Alta</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Baja</th>
                {isStudentTab ? <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Cuota</th> : null}
                {isStudentTab ? <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Cond.</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!filtered.length && (
                <tr>
                  <td colSpan={colSpanCount} className="px-6 py-12 text-center text-gray-400">
                    {q || role || status ? 'Sin resultados para esa búsqueda.' : 'No hay usuarios aún.'}
                  </td>
                </tr>
              )}
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
      </div>
    </>
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
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <Link href={`/dashboard/students/${s.id}`} className="flex items-center gap-3 font-medium text-gray-900 hover:text-brand-500">
          {s.avatar_url ? (
            <Image src={s.avatar_url} alt={s.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
              {(s.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
          )}
          {s.name}
        </Link>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">{s.email}</td>
      <td className="px-6 py-4 text-sm text-gray-500">{s.phone || <span className="text-gray-300">—</span>}</td>
      <td className="px-6 py-4">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${roleBadge[s.role] ?? 'bg-gray-100 text-gray-600'}`}>
          {roleLabel[s.role] ?? s.role}
        </span>
      </td>
      {isStudentTab && (
        <td className="px-6 py-4">
          {s.role !== 'student' ? (
            <span className="text-sm text-gray-300">—</span>
          ) : level ? (
            <span className="rounded-full px-2.5 py-1 text-xs font-medium text-white whitespace-nowrap" style={{ backgroundColor: level.color }}>
              {level.name}
            </span>
          ) : (
            <span className="text-sm text-gray-400">Sin asignar</span>
          )}
        </td>
      )}
      <td className="px-6 py-4">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.is_active ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500'}`}>
          {s.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(s.start_date ?? s.created_at)}</td>
      <td className="px-6 py-4 text-sm text-gray-500">{s.end_date ? formatDate(s.end_date) : '—'}</td>
      {isStudentTab && (
        <td className="px-6 py-4 text-sm">
          {s.role !== 'student' ? (
            <span className="text-gray-300">—</span>
          ) : cuotaCents === null ? (
            <span className="text-gray-300">—</span>
          ) : isEditing && enrollment?.id ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="0.01"
                value={editingValue}
                onChange={(e) => onChangeCuotaValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSave(enrollment.id!, s.id, editingValue)
                  if (e.key === 'Escape') onCancelEdit()
                }}
                className="w-20 rounded border border-brand-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                autoFocus
              />
              <button
                onClick={() => onSave(enrollment.id!, s.id, editingValue)}
                disabled={savingCuota}
                className="rounded bg-brand-500 px-2 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                ✓
              </button>
              <button onClick={onCancelEdit} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (enrollment?.id) onStartEdit(s.id, (cuotaCents / 100).toFixed(2))
              }}
              className={`text-sm font-medium ${enrollment?.id ? 'cursor-pointer text-gray-700 hover:text-brand-500' : 'cursor-default text-gray-500'}`}
              title={enrollment?.id ? 'Clic para editar' : 'Múltiples matrículas — edita desde el perfil del alumno'}
            >
              {(cuotaCents / 100).toFixed(2)}€/mes{!enrollment?.id ? ' *' : ''}
            </button>
          )}
        </td>
      )}
      {isStudentTab && (
        <td className="px-6 py-4 text-sm">
          {s.terms_accepted_at ? (
            <span className="text-green-600" title={formatDate(s.terms_accepted_at)}>✓</span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </td>
      )}
    </tr>
  )
})
