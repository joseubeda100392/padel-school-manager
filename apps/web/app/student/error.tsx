'use client'

import { useEffect } from 'react'

export default function SectionError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">⚠️</div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Algo ha salido mal</h2>
        <p className="mt-2 rounded-lg bg-red-50 px-4 py-3 text-left text-xs font-mono text-red-700 max-w-lg break-all">
          {error?.message ?? 'Error desconocido'}
        </p>
        {error?.stack && (
          <details className="mt-2 max-w-lg text-left">
            <summary className="cursor-pointer text-xs text-gray-400">Stack trace</summary>
            <pre className="mt-1 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-600">{error.stack}</pre>
          </details>
        )}
      </div>
      <button
        onClick={reset}
        className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Reintentar
      </button>
    </div>
  )
}
