'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MfaPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = (data?.totp ?? []).filter(f => f.status === 'verified')
      if (verified.length > 0) setFactorId(verified[0].id)
      else window.location.href = '/login/mfa/enroll'
    })
    inputRef.current?.focus()
  }, [])

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setLoading(true)
    setError('')

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challengeData) {
      setError('Error al iniciar verificación')
      setLoading(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: code.trim(),
    })

    if (verifyError) {
      setError('Código incorrecto')
      setCode('')
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/recovery-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Código incorrecto o ya usado')
      setLoading(false)
      return
    }

    window.location.href = '/login/mfa/enroll'
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500">
            <span className="text-xl font-bold text-white">P</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {useRecovery ? 'Código de recuperación' : 'Verificación en dos pasos'}
          </h1>
          <p className="mt-1 text-center text-sm text-gray-500">
            {useRecovery
              ? 'Introduce uno de tus códigos de recuperación'
              : 'Introduce el código de 6 dígitos de tu app de autenticación'}
          </p>
        </div>

        <form onSubmit={useRecovery ? handleRecovery : handleTotp} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            inputMode={useRecovery ? 'text' : 'numeric'}
            maxLength={useRecovery ? 19 : 6}
            value={code}
            onChange={(e) => setCode(useRecovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))}
            required
            autoComplete="one-time-code"
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-center text-2xl tracking-widest text-gray-900 placeholder-gray-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder={useRecovery ? 'XXXX-XXXX-XXXX-XXXX' : '000000'}
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || (useRecovery ? code.replace(/-/g, '').length !== 16 : code.length !== 6)}
            className="w-full rounded-lg bg-brand-500 py-2.5 font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setUseRecovery(!useRecovery); setCode(''); setError('') }}
          className="mt-4 block w-full text-center text-sm text-gray-400 hover:text-brand-500"
        >
          {useRecovery ? '← Usar código del autenticador' : 'Usar código de recuperación'}
        </button>
      </div>
    </main>
  )
}
