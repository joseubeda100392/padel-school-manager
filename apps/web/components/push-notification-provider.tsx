'use client'

import { useEffect, useRef, useState } from 'react'

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
export function PushNotificationProvider() {
  const [show, setShow] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const regRef = useRef<ServiceWorkerRegistration | null>(null)

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
        setShow(true)
      })
      .catch(err => console.error('[push] service worker registration failed:', err))
    return () => { cancelled = true }
  }, [])

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
    <div className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl bg-white shadow-lg border border-gray-100 p-4 md:bottom-6 md:left-auto md:right-6 md:max-w-xs">
      <p className="text-sm font-semibold text-gray-900">Activa las notificaciones</p>
      <p className="mt-1 text-xs text-gray-500">
        Recibe avisos cuando se libere un hueco en tu grupo o el admin te mande un mensaje.
      </p>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleEnable}
          disabled={working}
          className="flex-1 rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {working ? 'Activando…' : 'Activar'}
        </button>
        <button
          onClick={() => setShow(false)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
