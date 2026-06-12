'use client'

export function ErrorView({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">⚠️</div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Algo ha salido mal</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ha ocurrido un error inesperado. Inténtalo de nuevo en unos segundos.
        </p>
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
