import { cn } from '@/lib/utils'

// Firma visual del sistema: una pista de pádel vista desde arriba (20 × 10 m),
// con la red, las líneas de saque a 6,95 m de la red y la línea central entre
// ellas. Se usa solo en la tarjeta de la próxima clase.
function CourtLines({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 100"
      preserveAspectRatio="none"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      fill="none"
      stroke="currentColor"
      vectorEffect="non-scaling-stroke"
    >
      <rect x="1" y="1" width="198" height="98" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line x1="30.5" y1="1" x2="30.5" y2="99" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line x1="169.5" y1="1" x2="169.5" y2="99" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line x1="30.5" y1="50" x2="169.5" y2="50" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line x1="100" y1="1" x2="100" y2="99" strokeWidth="1.5" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function CourtCard({
  eyebrow,
  title,
  meta,
  aside,
  footer,
  className,
}: {
  eyebrow: React.ReactNode
  title: React.ReactNode
  meta?: React.ReactNode
  aside?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('relative overflow-hidden rounded-card bg-chrome text-chrome-ink shadow-card', className)}>
      <CourtLines className="inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] text-chrome-ink/[0.11]" />
      <div className="relative flex flex-wrap items-end justify-between gap-4 px-6 pb-6 pt-5 sm:px-8 sm:pt-6">
        <div className="min-w-0">
          <p className="text-meta font-medium text-accent">{eyebrow}</p>
          <p className="mt-2 font-display text-display text-white">{title}</p>
          {meta && <div className="mt-1.5 text-body tabular-nums text-chrome-ink-2">{meta}</div>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {footer && <div className="relative border-t border-chrome-line px-6 py-3 sm:px-8">{footer}</div>}
    </section>
  )
}
