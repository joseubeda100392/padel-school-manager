'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

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

    if (role === 'admin' || role === 'super_admin') {
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const verifiedTotp = (factorsData?.totp ?? []).filter(f => f.status === 'verified')
      window.location.href = verifiedTotp.length === 0 ? '/login/mfa/enroll' : '/login/mfa'
      return
    }

    window.location.href = role === 'student' ? '/student' : '/dashboard'
  }

  return (
    <main className="flex min-h-screen">
      {/* Panel izquierdo — branding */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-court-900 p-12 lg:flex lg:w-[480px] xl:w-[560px]">
        {/* Grid sutil de fondo */}
        <div className="pointer-events-none absolute inset-0">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="court-grid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" opacity="0.04" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#court-grid)" />
          </svg>
        </div>
        {/* Orbs de luz ambiental */}
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-blue-500">
            <span className="text-base font-bold text-white">P</span>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="font-display text-[52px] font-bold leading-[1.1] text-white">
            Gestiona<br />tu escuela<br />de <span className="text-brand-400">pádel.</span>
          </h1>
          <p className="text-lg leading-relaxed text-court-300">
            Alumnos, clases y pagos<br />en un solo lugar.
          </p>
        </div>

        <div className="relative text-xs text-court-400">
          © 2026 Padel School Manager
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-blue-500 lg:hidden">
            <span className="text-lg font-bold text-white">P</span>
          </div>

          <h2 className="mt-6 font-display text-2xl font-bold text-gray-900">Bienvenido</h2>
          <p className="mt-1 text-sm text-gray-500">Accede a tu panel de administración</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder="admin@tuescuela.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {loading ? 'Accediendo...' : 'Entrar'}
            </button>
          </form>

          <a
            href="/login/forgot-password"
            className="mt-5 block text-center text-sm text-gray-400 transition hover:text-brand-500"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>
      </div>
    </main>
  )
}
