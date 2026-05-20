'use client'

import { useEffect, useState } from 'react'

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
    setPermission(Notification.permission)
    if (Notification.permission === 'granted') {
      registerAndSubscribe()
    }
  }, [])

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
    <div className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl bg-white shadow-lg border border-gray-100 p-4 md:bottom-6 md:left-auto md:right-6 md:max-w-xs">
      <p className="text-sm font-semibold text-gray-900">Activa las notificaciones</p>
      <p className="mt-1 text-xs text-gray-500">
        Recibe avisos cuando se libere un hueco en tu grupo o el admin te mande un mensaje.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleEnable}
          className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
        >
          Activar
        </button>
        <button
          onClick={() => setPermission('denied')}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
