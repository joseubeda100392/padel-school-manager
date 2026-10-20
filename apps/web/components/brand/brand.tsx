import { cn } from '@/lib/utils'

export const BRAND_NAME = 'ePadel School'
export const APP_VERSION = '3.0'

type Tone = 'light' | 'dark'

// Logo + nombre del producto. `dark` = sobre el azul noche (menú, login).
export function BrandLockup({ tone = 'light', size = 'md', className }: { tone?: Tone; size?: 'sm' | 'md'; className?: string }) {
  const icon = size === 'sm' ? 'h-7 w-7 rounded-lg' : 'h-10 w-10 rounded-xl'
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src="/icon.svg" alt="" width={40} height={40} className={cn('shrink-0', icon)} />
      <span
        className={cn(
          'font-display font-semibold tracking-[-0.02em]',
          size === 'sm' ? 'text-[1rem]' : 'text-[1.25rem]',
          tone === 'dark' ? 'text-white' : 'text-ink',
        )}
      >
        ePadel<span className={tone === 'dark' ? 'text-accent' : 'text-accent-ink'}> School</span>
      </span>
    </span>
  )
}

// Firma discreta del producto dentro de la app del club: el club manda, pero
// la marca se ve siempre.
export function PoweredBy({ tone = 'light', showVersion = false, className }: { tone?: Tone; showVersion?: boolean; className?: string }) {
  return (
    <p className={cn('text-meta', tone === 'dark' ? 'text-chrome-ink-2' : 'text-ink-3', className)}>
      Funciona con{' '}
      <span className={cn('font-display font-semibold tracking-[-0.01em]', tone === 'dark' ? 'text-white' : 'text-ink')}>
        {BRAND_NAME}
      </span>
      {showVersion && <span> · versión {APP_VERSION}</span>}
    </p>
  )
}
