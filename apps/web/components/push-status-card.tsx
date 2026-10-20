'use client'

import { useEffect, useRef, useState } from 'react'
import { BellOff, BellRing, CircleCheck, Share, SquarePlus } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getPushState, isIos, pushErrorMessage, pushSupported, registerServiceWorker, subscribePush, type PushState } from '@/lib/push-client'

// Estado de los avisos en ESTE dispositivo y qué hacer en cada caso. Siempre
// a mano (Más, Notificaciones, Ayuda): la ventana "Activa los avisos" solo sale
// al abrir la app y, si se pulsa "Ahora no", tarda una semana en volver.
export function PushStatusCard({ hideWhenOn = false, className }: { hideWhenOn?: boolean; className?: string }) {
  const [state, setState] = useState<PushState>('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const regRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (pushSupported()) regRef.current = await registerServiceWorker()
        const s = await getPushState(regRef.current)
        if (!cancelled) setState(s)
      } catch {
        if (!cancelled) setState('unsupported')
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function activate() {
    setBusy(true)
    setError('')
    try {
      await subscribePush(regRef.current)
      setState('on')
      toast.success('Avisos activados en este móvil')
    } catch (err) {
      setError(pushErrorMessage(err))
      if (Notification.permission === 'denied') setState('denied')
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setBusy(true)
    setError('')
    const res = await fetch('/api/push/test', { method: 'POST' }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : {}
    if (res?.ok && json.pushed > 0) toast.success('Enviado: te llegará en unos segundos')
    else if (res?.status === 429) setError('Has enviado varios avisos de prueba seguidos. Espera unos minutos.')
    else setError('No hemos podido enviarlo a tu móvil. Pulsa "Volver a activar" y prueba otra vez.')
    setBusy(false)
  }

  if (state === 'checking' || (hideWhenOn && state === 'on')) return null

  return (
    <Card className={className}>
      <div className="flex gap-3 p-4 sm:p-5">
        <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${state === 'on' ? 'bg-accent-soft text-accent-ink' : 'bg-ink/[0.05] text-ink-2'}`}>
          {state === 'on' ? <CircleCheck className="h-5 w-5" /> : state === 'denied' ? <BellOff className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-label font-semibold text-ink">
            {state === 'on' ? 'Avisos activados en este móvil' : 'Avisos en el móvil'}
          </p>

          {state === 'on' && (
            <>
              <p className="text-meta text-ink-2">Te llegarán los huecos libres, los mensajes del chat y los recordatorios del club.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={sendTest} loading={busy}>Enviarme un aviso de prueba</Button>
                {error && <Button size="sm" variant="ghost" onClick={activate} disabled={busy}>Volver a activar</Button>}
              </div>
            </>
          )}

          {state === 'off' && (
            <>
              <p className="text-meta text-ink-2">Actívalos para enterarte al momento de los huecos libres, los mensajes del club y los recordatorios.</p>
              <Button size="sm" onClick={activate} loading={busy}>Activar avisos</Button>
            </>
          )}

          {state === 'ios-install' && (
            <>
              <p className="text-meta text-ink-2">En iPhone los avisos solo funcionan con la app en la pantalla de inicio:</p>
              <ol className="space-y-1.5 text-meta text-ink-2">
                <li>1. Abre esta página en <strong>Safari</strong>.</li>
                <li className="flex flex-wrap items-center gap-1">2. Pulsa <Share className="h-4 w-4 text-accent-ink" aria-label="Compartir" /> <strong>Compartir</strong> (abajo).</li>
                <li className="flex flex-wrap items-center gap-1">3. Elige <SquarePlus className="h-4 w-4 text-accent-ink" aria-hidden /> <strong>Añadir a pantalla de inicio</strong>.</li>
                <li>4. Abre la app desde el icono nuevo y pulsa <strong>Activar avisos</strong>.</li>
              </ol>
            </>
          )}

          {state === 'denied' && (
            <>
              <p className="text-meta text-ink-2">Los avisos están bloqueados en este móvil. Para volver a recibirlos:</p>
              <p className="text-meta text-ink-2">
                {isIos()
                  ? <>Ve a <strong>Ajustes → Notificaciones</strong>, busca la app de la escuela y activa <strong>Permitir notificaciones</strong>. Después vuelve a abrir la app.</>
                  : <>Mantén pulsado el icono de la app → <strong>Información de la app → Notificaciones</strong> y actívalas. Si la usas en Chrome: toca el candado junto a la dirección → <strong>Permisos → Notificaciones → Permitir</strong>.</>}
              </p>
            </>
          )}

          {state === 'unsupported' && (
            <p className="text-meta text-ink-2">Este navegador no permite avisos. En Android usa <strong>Chrome</strong>; en iPhone, añade la app a la pantalla de inicio desde <strong>Safari</strong>.</p>
          )}

          {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}
        </div>
      </div>
    </Card>
  )
}
