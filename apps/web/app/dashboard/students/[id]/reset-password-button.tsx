'use client'

import { useState } from 'react'

export function ResetPasswordButton({ email }: { email: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleClick() {
    setStatus('loading')
    setErrorMsg('')
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const json = await res.json()
    if (!res.ok) {
      setErrorMsg(json.error ?? 'Error al enviar el email')
      setStatus('error')
      return
    }
    setStatus('sent')
  }

  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
        ✓ Email enviado
      </span>
    )
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={handleClick}
        disabled={status === 'loading'}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        {status === 'loading' ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            Enviando...
          </>
        ) : (
          <>🔑 Restablecer contraseña</>
        )}
      </button>
      {status === 'error' && (
        <p className="text-xs text-red-600">{errorMsg}</p>
      )}
    </div>
  )
}
