'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function PasswordChangeGate({ clubName }: { clubName: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      // Usar el cliente del browser para mantener la sesión activa
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('Error al actualizar la contraseña.')
        setLoading(false)
        return
      }

      // Limpiar el flag en la BD
      await fetch('/api/auth/clear-password-flag', { method: 'POST' })

      window.location.replace('/student')
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg overflow-hidden">
        <div className="bg-brand-500 px-8 py-6">
          <p className="text-sm text-brand-100">{clubName}</p>
          <h1 className="mt-1 text-xl font-bold text-white">Elige tu contraseña</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <p className="text-sm text-gray-500">
            Has accedido con una contraseña temporal. Elige una contraseña personal para continuar.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Repite la contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar contraseña y entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
