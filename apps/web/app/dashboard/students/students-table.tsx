'use client'

import Image from 'next/image'
import { useState, useMemo } from 'react'
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

interface Props {
  students: any[]
  levelMap: Record<string, any>
  defaultTab?: string
}

const TABS = [
  { value: '', label: 'Todos' },
  { value: 'student', label: 'Alumnos' },
  { value: 'coach', label: 'Monitores' },
  { value: 'admin', label: 'Admins' },
]

export default function StudentsTable({ students, levelMap, defaultTab = 'student' }: Props) {
  const [q, setQ] = useState('')
  const [role, setRole] = useState(defaultTab)
  const [status, setStatus] = useState('')

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

  const filtered = useMemo(() => {
    const qLower = q.toLowerCase()
    return students.filter((s) => {
      const matchQ = !q || (s.name ?? '').toLowerCase().includes(qLower) || (s.email ?? '').toLowerCase().includes(qLower)
      const matchRole = !role || s.role === role
      const matchStatus = status === '' || (status === 'active' ? s.is_active : !s.is_active)
      return matchQ && matchRole && matchStatus
    })
  }, [students, q, role, status])

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
        {(q || role || status) && (
          <button
            onClick={() => { setQ(''); setRole(''); setStatus('') }}
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
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Rol</th>
                {role === 'student' ? <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nivel</th> : null}
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Alta</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Baja</th>
                {role === 'student' ? <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Cond.</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!filtered.length && (
                <tr>
                  <td colSpan={role === 'student' ? 8 : 6} className="px-6 py-12 text-center text-gray-400">
                    {q || role || status ? 'Sin resultados para esa búsqueda.' : 'No hay usuarios aún.'}
                  </td>
                </tr>
              )}
              {filtered.map((s) => {
                const level = s.current_level_id ? levelMap[s.current_level_id] : null
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <a href={`/dashboard/students/${s.id}`} className="flex items-center gap-3 font-medium text-gray-900 hover:text-brand-500">
                        {s.avatar_url ? (
                          <Image src={s.avatar_url} alt={s.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                            {(s.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                        )}
                        {s.name}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{s.email}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${roleBadge[s.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {roleLabel[s.role] ?? s.role}
                      </span>
                    </td>
                    {(role === 'student') && (
                      <td className="px-6 py-4">
                        {s.role !== 'student' ? (
                          <span className="text-sm text-gray-300">—</span>
                        ) : level ? (
                          <span className="rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ backgroundColor: level.color }}>
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
                    {(role === 'student') && (
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
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
