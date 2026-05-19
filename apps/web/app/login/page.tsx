'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const supabase = createClient()

  async function handleForgotPassword() {
    if (!email) {
      setError('Introduce tu email primero')
      return
    }
    setResetLoading(true)
    setError('')
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setResetSent(true)
    setResetLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    const role = data.user?.user_metadata?.role
    window.location.href = role === 'student' ? '/student' : '/dashboard'
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-600">
            <span className="text-xl font-bold text-white">P</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Padel School Manager</h1>
          <p className="mt-1 text-sm text-gray-500">Panel de Administración</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="admin@tuescuela.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
          )}

          {resetSent && (
            <p className="rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700">
              ✓ Te hemos enviado un enlace para restablecer tu contraseña.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-600 py-2.5 font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? 'Accediendo...' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetLoading}
            className="w-full text-center text-sm text-gray-500 hover:text-green-600 disabled:opacity-60"
          >
            {resetLoading ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
          </button>
        </form>
      </div>
    </main>
  )
}
