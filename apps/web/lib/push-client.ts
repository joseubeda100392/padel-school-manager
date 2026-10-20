'use client'

// Activar avisos en el navegador. Lo usan la ventana "Activa los avisos" y la
// tarjeta "Avisos en el móvil": un solo sitio con el orden que funciona en
// iPhone (subscribe() es lo primero que se espera dentro del toque).

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

export type PushState =
  | 'checking'
  | 'unsupported'   // navegador sin avisos (o iPhone en Safari sin instalar)
  | 'ios-install'   // iPhone/iPad: hay que añadir la app a la pantalla de inicio
  | 'denied'        // el alumno los bloqueó en el sistema
  | 'off'           // se pueden activar
  | 'on'            // activados en este dispositivo

export function isIos() {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr
}

export async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }),
  })
  if (!res.ok) throw new Error(`el servidor respondió ${res.status}`)
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export async function getPushState(reg?: ServiceWorkerRegistration | null): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const registration = reg ?? await navigator.serviceWorker.getRegistration('/sw.js') ?? await registerServiceWorker()
  const sub = await registration.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

// Llamar directamente desde el onClick, sin esperas antes (iPhone).
export async function subscribePush(reg: ServiceWorkerRegistration | null): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new Error('falta la clave de avisos en la configuración de la app')
  const registration = reg ?? await navigator.serviceWorker.ready
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  })
  await saveSubscription(sub)
}

export function pushErrorMessage(err: unknown) {
  return Notification.permission === 'denied'
    ? 'Has bloqueado los avisos. Puedes activarlos en los ajustes del móvil.'
    : `No se pudieron activar los avisos: ${err instanceof Error ? err.message : String(err)}`
}
