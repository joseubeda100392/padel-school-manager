'use client'

import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'push-prompt-dismissed-until'
const DISMISS_DAYS = 7

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

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer
}

export function PushNotificationProvider() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('denied')
      return
    }
    if (Notification.permission === 'granted') {
      setPermission('granted')
      registerAndSubscribe()
      return
    }
    if (recentlyDismissed() || shouldWaitForInstall()) return
    setPermission(Notification.permission)
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000))
    } catch {}
    setPermission('denied')
  }

  async function registerAndSubscribe() {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        setSubscribed(true)
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      })
      setSubscribed(true)
    } catch {
      // SW registration or subscription failed silently
    }
  }

  async function handleEnable() {
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      await registerAndSubscribe()
    }
  }

  if (permission === null || permission === 'granted' || permission === 'denied') return null

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
          <p className="mt-0.5 text-meta text-ink-2">Te avisamos cuando se libere un hueco de tu nivel o el club te escriba.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleEnable}>Activar avisos</Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Ahora no</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
