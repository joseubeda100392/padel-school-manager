'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  name: string
  email: string
  levelName: string | null
}

export function PerfilClient({ name, email, levelName }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (password.length < 6) {
      setPwError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setPwError('Las contraseñas no coinciden.')
      return
    }

    setPwLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setPwLoading(false)

    if (error) {
      setPwError('Error al actualizar la contraseña. Inténtalo de nuevo.')
      return
    }

    setPwSuccess(true)
    setPassword('')
    setConfirm('')
  }

  return (
    <div className="space-y-4">
      {/* Datos personales */}
      <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Datos personales</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nombre</p>
            <p className="mt-1 text-sm text-gray-800">{name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Email</p>
            <p className="mt-1 text-sm text-gray-800">{email}</p>
          </div>
          {levelName && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nivel actual</p>
              <p className="mt-1 text-sm text-gray-800">{levelName}</p>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400">Para cambiar tu nombre o email contacta con el club.</p>
      </div>

      {/* Cambiar contraseña */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Cambiar contraseña</h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Repite la contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {pwError && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{pwError}</p>
          )}
          {pwSuccess && (
            <p className="rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700">Contraseña actualizada correctamente.</p>
          )}

          <button
            type="submit"
            disabled={pwLoading || !password}
            className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            {pwLoading ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
