'use client'

import { useState, useEffect } from 'react'
import { Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) return

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    setIsStandalone(standalone)
    if (standalone) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIos(ios)

    const isMobile =
      ios ||
      /android/i.test(navigator.userAgent) ||
      (navigator as any).userAgentData?.mobile === true

    if (!isMobile) return

    if (ios) {
      setShow(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem('pwa-install-dismissed', '1')
    setShow(false)
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-install-dismissed', '1')
    }
    setDeferredPrompt(null)
    setShow(false)
  }

  if (!show || isStandalone) return null

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.75rem)] z-40 mx-auto max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-300 md:inset-x-auto md:bottom-6 md:right-6"
    >
      <div className="flex items-start gap-3 rounded-card bg-chrome p-4 text-chrome-ink shadow-overlay">
        <img src="/icon.svg" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-[10px]" />
        <div className="min-w-0 flex-1">
          <p id="install-title" className="text-label font-semibold text-white">Instala la app</p>
          {isIos ? (
            <ol className="mt-1.5 space-y-1 text-meta text-chrome-ink-2">
              <li>1. Pulsa <Share className="inline h-3.5 w-3.5 align-[-2px]" aria-label="Compartir" /> en la barra de Safari (o en los ··· si no lo ves)</li>
              <li>2. Elige <strong className="font-medium text-chrome-ink">Añadir a pantalla de inicio</strong></li>
            </ol>
          ) : (
            <p className="mt-0.5 text-meta text-chrome-ink-2">Ábrela desde tu pantalla de inicio, como cualquier app.</p>
          )}
          {!isIos && (
            <Button size="sm" onClick={install} className="mt-3">Instalar</Button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-chrome-ink-2 hover:bg-chrome-2 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
