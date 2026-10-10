import { Skeleton } from './feedback'

// Esqueleto genérico de pantalla mientras carga: cabecera + bloque principal +
// lista. Mantiene la forma de la página para que no haya saltos.
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-40 w-full rounded-card" />
      <div className="space-y-3 rounded-card border border-line bg-surface p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
