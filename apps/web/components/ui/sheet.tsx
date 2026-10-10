'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const CLOSE_DISTANCE = 120
const CLOSE_VELOCITY = 0.5

// Hoja inferior en móvil y ventana centrada desde `sm`. Usa <dialog> nativo:
// el navegador ya atrapa el foco, bloquea el fondo y cierra con Escape.
// En móvil se cierra también arrastrando hacia abajo (distancia o velocidad).
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startT: number; dy: number } | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setClosing(false)
      dialog.showModal()
    } else if (!open && dialog.open) {
      setClosing(true)
      const t = setTimeout(() => dialog.close(), 200)
      return () => clearTimeout(t)
    }
  }, [open])

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse') return
    drag.current = { startY: e.clientY, startT: Date.now(), dy: 0 }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !panelRef.current) return
    const dy = e.clientY - drag.current.startY
    drag.current.dy = dy
    // Hacia arriba ofrece resistencia en vez de un tope seco.
    const offset = dy > 0 ? dy : -Math.sqrt(-dy) * 2
    panelRef.current.style.transition = 'none'
    panelRef.current.style.transform = `translateY(${offset}px)`
  }

  function onPointerUp() {
    if (!drag.current || !panelRef.current) return
    const { dy, startT } = drag.current
    const velocity = dy / Math.max(1, Date.now() - startT)
    drag.current = null
    panelRef.current.style.transition = ''
    panelRef.current.style.transform = ''
    if (dy > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) onClose()
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      aria-labelledby="sheet-title"
      className={cn(
        'group m-0 mt-auto max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-ink/40',
        'sm:m-auto sm:w-[min(32rem,calc(100vw-2rem))]',
        'backdrop:transition-opacity backdrop:duration-200',
        closing && 'backdrop:opacity-0',
      )}
      data-state={closing ? 'closed' : 'open'}
    >
      <div
        ref={panelRef}
        className={cn(
          'flex max-h-[90dvh] flex-col rounded-t-sheet bg-surface shadow-overlay sm:rounded-sheet',
          'transition-[transform,opacity] duration-300 ease-drawer',
          'animate-in slide-in-from-bottom fade-in-0 duration-300 sm:slide-in-from-bottom-0 sm:zoom-in-95',
          closing && 'translate-y-full opacity-0 duration-200 sm:translate-y-0 sm:scale-95',
          className,
        )}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 sm:hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-ink/15" />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pt-2 sm:pt-5">
          <div className="min-w-0">
            <h2 id="sheet-title" className="text-title text-ink">{title}</h2>
            {description && <p className="mt-1 text-body text-ink-2">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 -mt-1 hidden h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-ink/5 hover:text-ink sm:flex"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children && <div className="overflow-y-auto px-5 pb-2 pt-4">{children}</div>}
        {footer && (
          <div
            className="flex flex-col-reverse gap-2 px-5 pt-4 sm:flex-row sm:justify-end"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 1.25rem)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </dialog>
  )
}
