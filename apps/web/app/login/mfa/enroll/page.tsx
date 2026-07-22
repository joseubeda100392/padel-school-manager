'use client'

import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import { createClient } from '@/lib/supabase/client'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  const raw = Array.from(array, b => chars[b % chars.length]).join('')
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
}

export default function MfaEnrollPage() {
  const [phase, setPhase] = useState<'qr' | 'codes'>('qr')
  const [factorId, setFactorId] = useState('')
  const [uri, setUri] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'ePadel School' }).then(({ data, error }) => {
      if (error || !data) return
      setFactorId(data.id)
      setUri(data.totp.uri)
      setSecret(data.totp.secret)
    })
  }, [])

  async function handleVerify(e: React.FormEvent) {
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
      code: verifyCode.trim(),
    })

    if (verifyError) {
      setError('Código incorrecto, inténtalo de nuevo')
      setVerifyCode('')
      setLoading(false)
      return
    }

    const codes = Array.from({ length: 10 }, generateCode)
    setRecoveryCodes(codes)

    const saveRes = await fetch('/api/auth/recovery-code/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: codes.map(c => c.replace(/-/g, '')) }),
    })

    if (!saveRes.ok) {
      setError('Error al guardar los códigos de recuperación. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    setPhase('codes')
    setLoading(false)
  }

  async function handleCopyAll() {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (phase === 'codes') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500">
              <span className="text-xl font-bold text-white">P</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Códigos de recuperación</h1>
            <p className="mt-1 text-center text-sm text-gray-500">
              Guárdalos en un lugar seguro. Solo los verás ahora.
            </p>
          </div>

          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Si pierdes el móvil, estos códigos son tu única forma de acceder. Cada código solo funciona una vez.
          </div>

          <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <ul className="space-y-1.5">
              {recoveryCodes.map((code, i) => (
                <li key={i} className="font-mono text-sm tracking-widest text-gray-800">{code}</li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={handleCopyAll}
            className="mb-4 w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {copied ? '✓ Copiados' : 'Copiar todos'}
          </button>

          <button
            type="button"
            onClick={() => { window.location.href = '/dashboard' }}
            className="w-full rounded-lg bg-brand-500 py-2.5 font-medium text-white transition hover:bg-brand-600"
          >
            He guardado mis códigos → Entrar
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500">
            <span className="text-xl font-bold text-white">P</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Configurar autenticador</h1>
          <p className="mt-1 text-center text-sm text-gray-500">
            Escanea el código QR con Google Authenticator, Authy u otra app TOTP
          </p>
        </div>

        {uri ? (
          <div className="mb-6 flex justify-center rounded-xl bg-white p-4 shadow-inner">
            <QRCode value={uri} size={180} />
          </div>
        ) : (
          <div className="mb-6 flex h-48 items-center justify-center rounded-xl bg-gray-50">
            <p className="text-sm text-gray-400">Cargando código QR...</p>
          </div>
        )}

        {secret && (
          <details className="mb-4">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
              ¿No puedes escanear el QR? Introducir código manual
            </summary>
            <p className="mt-2 break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700">{secret}</p>
          </details>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Código de verificación
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              required
              autoComplete="one-time-code"
              autoFocus
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-center text-2xl tracking-widest text-gray-900 placeholder-gray-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="000000"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || verifyCode.length !== 6}
            className="w-full rounded-lg bg-brand-500 py-2.5 font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? 'Verificando...' : 'Confirmar y activar 2FA'}
          </button>
        </form>
      </div>
    </main>
  )
}
