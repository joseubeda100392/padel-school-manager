'use client'

import { useEffect, useState, type RefObject } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const MIN_HIDDEN_PX = 120
const SCROLLED_PX = 40

// Indica que la pantalla sigue más abajo: difumina el borde inferior y muestra
// una flecha. Se oculta en cuanto el usuario empieza a bajar o si lo que
// queda por debajo es poco. Vigila el <main> del shell, que tiene scroll propio.
export function ScrollHint({ target }: { target: RefObject<HTMLElement> }) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = target.current
    if (!el) return
    const update = () => {
      const remaining = el.scrollHeight - el.clientHeight - el.scrollTop
      setVisible(remaining > MIN_HIDDEN_PX && el.scrollTop < SCROLLED_PX)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    const mo = new MutationObserver(update)
    mo.observe(el, { childList: true, subtree: true })
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
      mo.disconnect()
    }
  }, [target, pathname])

  function scrollDown() {
    const el = target.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ top: Math.round(el.clientHeight * 0.7), behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom))] z-10 flex h-20 items-end justify-center pb-3 md:bottom-0',
        'bg-gradient-to-t from-canvas via-canvas/80 to-transparent transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <button
        type="button"
        onClick={scrollDown}
        tabIndex={visible ? 0 : -1}
        aria-label="Ver más contenido abajo"
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full bg-chrome text-white shadow-overlay transition-transform duration-200',
          visible ? 'pointer-events-auto translate-y-0' : 'translate-y-2',
        )}
      >
        <ChevronDown className="h-5 w-5" aria-hidden />
      </button>
    </div>
  )
}
