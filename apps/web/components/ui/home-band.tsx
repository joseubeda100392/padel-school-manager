import { cn } from '@/lib/utils'

// Franja de marca de las portadas (solo móvil): azul noche de borde a borde
// detrás del saludo, que termina a media altura del primer bloque, con la pista
// como marca de agua muy tenue. En ordenador el menú lateral ya da ese carácter.
// Los textos de la cabecera deben usar las variantes `max-md:` claras.
export function HomeBand({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div aria-hidden className="absolute -inset-x-4 -top-5 bottom-16 overflow-hidden bg-gradient-to-b from-chrome to-chrome-deep md:hidden">
        <svg viewBox="0 0 200 100" className="absolute -right-10 top-4 h-40 w-auto text-chrome-ink/[0.07]" fill="none" stroke="currentColor">
          <rect x="1" y="1" width="198" height="98" rx="2" strokeWidth="1.5" />
          <line x1="30.5" y1="1" x2="30.5" y2="99" strokeWidth="1.5" />
          <line x1="169.5" y1="1" x2="169.5" y2="99" strokeWidth="1.5" />
          <line x1="30.5" y1="50" x2="169.5" y2="50" strokeWidth="1.5" />
          <line x1="100" y1="-3" x2="100" y2="103" strokeWidth="2.5" />
        </svg>
      </div>
      <div className="relative space-y-6">{children}</div>
    </div>
  )
}
