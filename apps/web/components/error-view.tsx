'use client'

import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ErrorView({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
        <TriangleAlert className="h-6 w-6" />
      </span>
      <div>
        <h2 className="text-heading text-ink">No se ha podido cargar esta pantalla</h2>
        <p className="mt-1 max-w-sm text-body text-ink-2">Suele ser un corte de conexión. Vuelve a intentarlo en unos segundos.</p>
      </div>
      <Button onClick={reset}>
        <RotateCw className="h-4 w-4" aria-hidden />
        Volver a intentarlo
      </Button>
    </div>
  )
}
