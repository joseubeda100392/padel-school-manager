import { cn } from '@/lib/utils'

// Firma visual del sistema: una pista de pádel vista desde arriba con sus
// proporciones reales (20 × 10 m): red, líneas de saque a 6,95 m de la red y
// línea central entre ellas. Es un elemento propio de la tarjeta, nunca un
// fondo bajo el texto.
function CourtLines({ label, className }: { label?: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 100" className={cn('overflow-visible', className)} fill="none">
      <rect x="1" y="1" width="198" height="98" rx="2" className="fill-white/[0.03] stroke-current" strokeWidth="1.5" />
      <line x1="30.5" y1="1" x2="30.5" y2="99" className="stroke-current" strokeWidth="1.5" />
      <line x1="169.5" y1="1" x2="169.5" y2="99" className="stroke-current" strokeWidth="1.5" />
      <line x1="30.5" y1="50" x2="169.5" y2="50" className="stroke-current" strokeWidth="1.5" />
      <line x1="100" y1="-3" x2="100" y2="103" className="stroke-accent" strokeWidth="2.5" strokeLinecap="round" />
      {label && (
        <text x="65" y="32" textAnchor="middle" className="fill-white font-sans text-[13px] font-semibold">
          {label}
        </text>
      )}
    </svg>
  )
}

export function CourtCard({
  eyebrow,
  title,
  meta,
  status,
  court,
  footer,
  className,
}: {
  eyebrow: React.ReactNode
  title: React.ReactNode
  meta?: React.ReactNode
  status?: React.ReactNode
  /** Nombre de la pista, se dibuja dentro de la pista en pantallas grandes. */
  court?: string
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('overflow-hidden rounded-card bg-chrome text-chrome-ink shadow-card', className)}>
      <div className="flex items-center gap-6 px-5 pb-5 pt-4 sm:px-7 sm:py-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-meta font-medium text-accent">{eyebrow}</p>
            <CourtLines className="h-9 w-auto shrink-0 text-chrome-ink/30 sm:hidden" />
          </div>
          <p className="mt-1.5 font-display text-[1.75rem] font-semibold leading-8 tracking-[-0.02em] text-white sm:mt-2 sm:text-display">
            {title}
          </p>
          {meta && <div className="mt-2 text-body tabular-nums text-chrome-ink-2">{meta}</div>}
          {status && <div className="mt-3">{status}</div>}
        </div>
        <CourtLines label={court} className="hidden h-[6.5rem] w-auto shrink-0 text-chrome-ink/35 sm:block" />
      </div>
      {footer && <div className="border-t border-chrome-line px-5 py-1 sm:px-7">{footer}</div>}
    </section>
  )
}
