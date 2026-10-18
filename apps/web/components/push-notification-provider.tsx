'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'push-prompt-dismissed-until'
const DISMISS_DAYS = 7
const REFRESH_MIN_MS = 30_000

// En el móvil, mientras la app no esté instalada, manda el aviso de instalar
// (en iPhone los avisos solo funcionan con la app instalada) y así nunca salen
// los dos a la vez.
function shouldWaitForInstall() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
  const mobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent) || (navigator as any).userAgentData?.mobile === true
  return mobile && !standalone && !localStorage.getItem('pwa-install-dismissed')
}

function recentlyDismissed() {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now()
  } catch {
    return false
  }
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }),
  })
  if (!res.ok) throw new Error(`el servidor respondió ${res.status}`)
}

// En iPhone (app instalada en la pantalla de inicio) Safari solo deja
// suscribirse a avisos si pushManager.subscribe() se llama directamente en
// el toque del usuario. Antes se pedía el permiso, se esperaba al service
// worker y DESPUÉS se suscribía: iOS lo rechazaba, el error se tragaba y,
// como el permiso ya estaba concedido, el aviso no volvía a salir (en oct.
// 2026 había 0 alumnos suscritos en toda la app). Ahora el service worker se
// prepara al cargar y en el toque lo primero es subscribe().
export function PushNotificationProvider({
  description = 'Te avisamos cuando se libere un hueco de tu nivel o el club te escriba.',
}: { description?: string } = {}) {
  const [show, setShow] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const regRef = useRef<ServiceWorkerRegistration | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    if (Notification.permission === 'denied') return
    let cancelled = false
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(async (reg) => {
        if (cancelled) return
        regRef.current = reg
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          // Ya suscrito en este móvil: se vuelve a guardar por si el
          // servidor no la tenía (p. ej. falló el guardado la primera vez).
          await saveSubscription(existing).catch(err => console.error('[push] re-sync failed:', err))
          return
        }
        if (recentlyDismissed() || shouldWaitForInstall()) return
        setShow(true)
      })
      .catch(err => console.error('[push] service worker registration failed:', err))
    return () => { cancelled = true }
  }, [])

  // La campanita se calcula en el servidor al cargar: con la app abierta no se
  // enteraba de los avisos nuevos. Ahora se refresca cuando llega un aviso
  // (el service worker lo avisa) y cuando la app vuelve de segundo plano.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; title?: string; body?: string; url?: string } | null
      if (data?.type !== 'push') return
      toast(data.title ?? 'Aviso nuevo', {
        description: data.body,
        action: data.url ? { label: 'Ver', onClick: () => router.push(data.url!) } : undefined,
      })
      router.refresh()
    }
    let lastRefresh = Date.now()
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh < REFRESH_MIN_MS) return
      lastRefresh = Date.now()
      router.refresh()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    navigator.serviceWorker.startMessages()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000))
    } catch {}
    setShow(false)
  }

  async function handleEnable() {
    setWorking(true)
    setError('')
    try {
      if (!VAPID_PUBLIC_KEY) throw new Error('falta la clave de avisos en la configuración de la app')
      const reg = regRef.current ?? await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
      await saveSubscription(sub)
      setShow(false)
    } catch (err) {
      setError(Notification.permission === 'denied'
        ? 'Has bloqueado los avisos. Puedes activarlos en los ajustes del móvil.'
        : `No se pudieron activar los avisos: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setWorking(false)
    }
  }

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-labelledby="push-prompt-title"
      className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.75rem)] z-40 mx-auto max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-300 md:inset-x-auto md:bottom-6 md:right-6"
    >
      <div className="flex gap-3 rounded-card border border-line bg-surface p-4 shadow-overlay">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="push-prompt-title" className="text-label font-semibold text-ink">Activa los avisos</p>
          <p className="mt-0.5 text-meta text-ink-2">{description}</p>
          {error && <p role="alert" className="mt-2 text-meta font-medium text-danger-ink">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleEnable} loading={working}>Activar avisos</Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Ahora no</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
