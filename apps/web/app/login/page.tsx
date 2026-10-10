'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'

function CourtDrawing() {
  return (
    <svg
      viewBox="0 0 200 100"
      fill="none"
      aria-hidden
      className="w-full max-w-md overflow-visible text-chrome-ink/20"
      strokeLinecap="square"
    >
      <rect x="1" y="1" width="198" height="98" stroke="currentColor" strokeWidth="1.5" />
      <line x1="30.5" y1="1" x2="30.5" y2="99" stroke="currentColor" strokeWidth="1.5" />
      <line x1="169.5" y1="1" x2="169.5" y2="99" stroke="currentColor" strokeWidth="1.5" />
      <line x1="30.5" y1="50" x2="169.5" y2="50" stroke="currentColor" strokeWidth="1.5" />
      <line x1="100" y1="-3" x2="100" y2="103" className="stroke-accent" strokeWidth="2" />
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

    // user_metadata puede desincronizarse del rol real en la tabla users
    // (p.ej. cuentas creadas fuera del flujo estándar) — la tabla es la
    // fuente de verdad, no el JWT metadata.
    const { data: profile } = await supabase.from('users').select('role').eq('id', data.user!.id).single()
    const role = profile?.role ?? data.user?.user_metadata?.role

    if (role === 'admin' || role === 'super_admin') {
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const verifiedTotp = (factorsData?.totp ?? []).filter(f => f.status === 'verified')
      if (verifiedTotp.length > 0) {
        window.location.replace('/login/mfa')
        return
      }
      // Sin MFA configurado → acceso directo al dashboard
    }

    window.location.replace(role === 'student' ? '/student' : role === 'coach' ? '/coach' : '/dashboard')
  }

  return (
    <main className="flex min-h-screen">
      <div className="hidden flex-col justify-between bg-chrome p-12 lg:flex lg:w-[480px] xl:w-[560px]">
        <img src="/icon.svg" alt="ePadel School" width={40} height={40} className="h-10 w-10 rounded-xl" />

        <div className="space-y-10">
          <CourtDrawing />
          <div className="space-y-4">
            <p className="font-display text-display text-white xl:text-[52px] xl:leading-[1.1]">
              Gestiona<br />tu escuela<br />de <span className="text-accent">pádel.</span>
            </p>
            <p className="text-heading font-normal text-chrome-ink-2">
              Alumnos, clases y pagos en un solo lugar.
            </p>
          </div>
        </div>

        <p className="text-meta text-chrome-ink-2">© 2026 ePadel School</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-surface px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <img
            src="/icon.svg"
            alt="ePadel School"
            width={48}
            height={48}
            className="mb-6 h-12 w-12 rounded-xl lg:hidden"
          />

          <h1 className="font-display text-title text-ink">Bienvenido</h1>
          <p className="mt-1 text-body text-ink-2">Entra con el email y la contraseña que te dio tu club</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Field label="Email">
              <Input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@email.com"
              />
            </Field>

            <Field label="Contraseña">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-control text-ink-3 hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </div>
            </Field>

            {error && (
              <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>
            )}

            <Button type="submit" size="lg" block loading={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <Link
            href="/login/forgot-password"
            className="mt-4 flex min-h-11 items-center justify-center text-label text-accent-ink underline-offset-4 hover:underline"
          >
            ¿Has olvidado la contraseña?
          </Link>
        </div>
      </div>
    </main>
  )
}
