'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

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
    <div className="fixed bottom-16 left-4 right-4 z-50 md:bottom-4 md:left-auto md:right-4 md:max-w-sm">
      <div className="flex items-start gap-3 rounded-xl bg-court-900 px-4 py-3 shadow-xl ring-1 ring-white/10">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500">
          <span className="text-base font-black text-white">e</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Instala la app</p>
          {isIos ? (
            <ol className="mt-1.5 space-y-1 text-xs text-court-300">
              <li>1. Pulsa el icono de compartir <strong className="text-court-200">⬆</strong> en la barra de Safari</li>
              <li>2. Toca <strong className="text-court-200">Compartir</strong></li>
              <li>3. Toca <strong className="text-court-200">Añadir a pantalla de inicio</strong> (si no la ves, pulsa <strong className="text-court-200">Ver más</strong> antes)</li>
            </ol>
          ) : (
            <p className="mt-0.5 text-xs text-court-300">
              Accede más rápido desde la pantalla de inicio.
            </p>
          )}
          {!isIos && (
            <button
              onClick={install}
              className="mt-2 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Instalar
            </button>
          )}
        </div>
        <button onClick={dismiss} className="shrink-0 rounded-lg p-1 text-court-400 hover:text-court-200">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
