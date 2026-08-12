'use client'

import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const DEFAULT_PASSWORD = 'miclave123'

export default function NewStudentPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'student' | 'coach' | 'admin'>('student')
  const [levelId, setLevelId] = useState('')
  const [levels, setLevels] = useState<any[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [tempPassword, setTempPassword] = useState(DEFAULT_PASSWORD)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/levels').then(r => r.json()),
      fetch('/api/admin/club-features').then(r => r.json()),
    ]).then(([levelsData, featData]) => {
      if (levelsData.levels) setLevels(levelsData.levels)
      if (featData.isSuperAdmin) setIsSuperAdmin(true)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, phone: phone.trim() || null, role, levelId: levelId || null, tempPassword }),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.error || 'Error creando usuario')
      setLoading(false)
      return
    }

    toast.success('Usuario creado correctamente')
    window.location.href = '/dashboard/students'
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/students" className="text-sm text-gray-500 hover:text-gray-700">
          ← Alumnos
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo usuario</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre completo *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Juan García"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="juan@email.com"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Teléfono</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="600 000 000"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Contraseña inicial *</label>
          <input
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Mínimo 6 caracteres"
          />
          <p className="mt-1 text-xs text-gray-400">Compártesela al usuario — podrá cambiarla luego desde su perfil.</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Rol *</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'student' | 'coach' | 'admin')}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="student">Alumno</option>
            <option value="coach">Monitor</option>
            {isSuperAdmin && <option value="admin">Admin</option>}
          </select>
        </div>

        {role === 'student' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Nivel inicial</label>
            {levels.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Este club no tiene niveles creados.{' '}
                <Link href="/dashboard/levels/new" className="font-medium underline hover:text-amber-900">
                  Crea los niveles primero
                </Link>{' '}
                para poder asignar uno al alumno.
              </div>
            ) : (
            <select
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Sin asignar</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href="/dashboard/students"
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  )
}
