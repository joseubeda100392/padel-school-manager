'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  pdfUrl: string
  clubName: string
}

export function TermsGate({ pdfUrl, clubName }: Props) {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAccept() {
    if (!accepted) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/student/accept-terms', { method: 'POST' })
    setLoading(false)
    if (!res.ok) {
      setError('Error al guardar la aceptación. Inténtalo de nuevo.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-lg overflow-hidden">
        <div className="bg-brand-500 px-8 py-6">
          <p className="text-sm text-brand-100">{clubName}</p>
          <h1 className="mt-1 text-xl font-bold text-white">Condiciones de Uso</h1>
        </div>

        <div className="p-8">
          <p className="mb-6 text-sm text-gray-500">
            Antes de acceder a la aplicación debes leer y aceptar las condiciones de uso del club.
          </p>

          {pdfUrl && pdfUrl.startsWith('http') ? (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => { window.open(pdfUrl, '_blank') }}
                className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left transition-colors hover:bg-gray-100"
              >
                <span className="text-3xl">📄</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Leer las condiciones de uso</p>
                  <p className="text-xs text-gray-400">Se abre en una nueva pestaña</p>
                </div>
                <span className="ml-auto text-gray-400">↗</span>
              </button>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-center text-xs text-brand-500 underline"
              >
                Si no se abre, pulsa aquí
              </a>
            </div>
          ) : (
            <div className="mb-6 flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-400">El club no ha subido aún el documento de condiciones.</p>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-brand-500"
            />
            <span className="text-sm text-gray-700">
              He leído y acepto las condiciones de uso de <strong>{clubName}</strong>
            </span>
          </label>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={handleAccept}
            disabled={!accepted || loading}
            className="mt-6 w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Guardando...' : 'Aceptar y continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}
