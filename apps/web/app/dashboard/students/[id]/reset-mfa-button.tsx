'use client'

import { useState } from 'react'

export function ResetMfaButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleReset() {
    if (!confirm('¿Resetear el MFA de este usuario? Deberá registrar su autenticador en el próximo login.')) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/reset-mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Error al resetear MFA')
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <p className="text-sm text-brand-500">MFA reseteado. El usuario deberá registrar su autenticador al próximo login.</p>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleReset}
        disabled={loading}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
      >
        {loading ? 'Reseteando...' : 'Resetear MFA'}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
