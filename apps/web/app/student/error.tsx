'use client'

import { useEffect } from 'react'

export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[PSM-ERROR]', error) }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <p className="text-5xl mb-4">⚠️</p>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Algo ha salido mal</h1>
      <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-left text-xs font-mono text-red-700 max-w-lg w-full overflow-auto">
        <p><strong>Tipo:</strong> {error.name}</p>
        <p><strong>Mensaje:</strong> {error.message || '(vacío — error de servidor)'}</p>
        <p><strong>Digest:</strong> {error.digest ?? '(sin digest)'}</p>
      </div>
      <button
        onClick={reset}
        className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
      >
        Reintentar
      </button>
    </div>
  )
}
