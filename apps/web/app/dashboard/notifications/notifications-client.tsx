'use client'

import { useState, useEffect } from 'react'
import { CircleCheck, Send } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { List, ListRow } from '@/components/ui/list'
import { cn } from '@/lib/utils'

type Target = 'all' | 'level' | 'payment_pending' | 'bag_pending'

export function NotificationsClient({ enablePayments }: { enablePayments: boolean }) {
  const defaultTarget: Target = 'all'
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState<Target>(defaultTarget)
  const [levelId, setLevelId] = useState('')
  const [levels, setLevels] = useState<{ id: string; name: string; color: string }[]>([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; sent?: number; error?: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/levels').then(r => r.json()).then(({ levels }) => {
      if (levels) setLevels(levels)
    })
  }, [])

  const isAutoTarget = target === 'payment_pending' || target === 'bag_pending'

  async function handleSend() {
    if (!isAutoTarget && (!title.trim() || !body.trim())) return
    setSending(true)
    setResult(null)

    const payload =
      target === 'payment_pending'
        ? { title: '💳 Cuota pendiente de pago', body: 'Tienes una cuota mensual sin pagar. Entra en la app para regularizarla.', target, url: '/student/schedule' }
        : target === 'bag_pending'
        ? { title: '🎾 Tienes clases disponibles', body: 'Tienes clases en tu bolsa sin usar. ¡Apúntate a tu próxima clase!', target, url: '/student/schedule' }
        : { title: title.trim(), body: body.trim(), target, levelId: levelId || undefined, url: '/student' }

    try {
      const res = await fetch('/api/push/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      let json: any = {}
      try { json = await res.json() } catch { /* respuesta no-JSON */ }
      setResult(res.ok ? { ok: true, sent: json.sent ?? 0 } : { ok: false, error: json.error ?? `Error ${res.status}` })
      if (res.ok && !isAutoTarget) {
        setTitle('')
        setBody('')
      }
    } catch (e: any) {
      setResult({ ok: false, error: 'Error de red: ' + (e?.message ?? 'desconocido') })
    } finally {
      setSending(false)
    }
  }

  const targetOptions = [
    { value: 'all' as Target, label: 'Todos los alumnos' },
    { value: 'level' as Target, label: 'Por nivel' },
    ...(enablePayments ? [{ value: 'payment_pending' as Target, label: 'Cuota pendiente' }] : []),
    { value: 'bag_pending' as Target, label: 'Clases en bolsa' },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Notificaciones push"
        description="Envía mensajes a los alumnos que hayan activado las notificaciones."
      />

      <Card>
        <CardHeader title="Recordatorios rápidos" description="Mensajes ya redactados para los casos más habituales." />
        <List className="mt-3 border-t border-line">
          {enablePayments && (
            <ListRow
              title="Recordatorio de cuota"
              subtitle="Alumnos con cuota mensual sin pagar."
              trailing={
                <Button
                  variant="secondary"
                  size="sm"
                  aria-pressed={target === 'payment_pending'}
                  onClick={() => { setTarget('payment_pending'); setTitle(''); setBody('') }}
                >
                  Seleccionar
                </Button>
              }
            />
          )}
          <ListRow
            title="Clases en bolsa"
            subtitle="Alumnos con clases disponibles sin usar."
            trailing={
              <Button
                variant="secondary"
                size="sm"
                aria-pressed={target === 'bag_pending'}
                onClick={() => { setTarget('bag_pending'); setTitle(''); setBody('') }}
              >
                Seleccionar
              </Button>
            }
          />
        </List>
      </Card>

      <Card>
        <CardHeader title="Nueva notificación" />
        <CardBody className="space-y-4">
          <fieldset>
            <legend className="text-label text-ink">Destinatarios</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {targetOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={target === opt.value}
                  onClick={() => setTarget(opt.value)}
                  className={cn(
                    'min-h-11 rounded-full border px-4 text-label transition-colors',
                    target === opt.value
                      ? 'border-accent-ink bg-accent-soft text-accent-ink'
                      : 'border-line-strong/60 bg-surface text-ink-2 hover:bg-surface-2',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          {target === 'level' && (
            <Field label="Nivel">
              <Select value={levelId} onChange={e => setLevelId(e.target.value)}>
                <option value="">Selecciona un nivel</option>
                {levels.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </Field>
          )}

          {target === 'payment_pending' ? (
            <div className="rounded-control bg-surface-2 px-4 py-3 text-body text-ink-2">
              <p className="text-label text-ink">Mensaje automático</p>
              <p className="mt-1 font-medium">Cuota pendiente de pago</p>
              <p className="text-meta text-ink-3">Tienes una cuota mensual sin pagar. Entra en la app para regularizarla.</p>
            </div>
          ) : target === 'bag_pending' ? (
            <div className="rounded-control bg-surface-2 px-4 py-3 text-body text-ink-2">
              <p className="text-label text-ink">Mensaje automático</p>
              <p className="mt-1 font-medium">Tienes clases disponibles</p>
              <p className="text-meta text-ink-3">Tienes clases en tu bolsa sin usar. ¡Apúntate a tu próxima clase!</p>
            </div>
          ) : (
            <>
              <Field label="Título">
                <Input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej: ¡Clase cancelada mañana!"
                  maxLength={100}
                />
              </Field>
              <Field
                label="Mensaje"
                hint={<span className="tabular-nums">{body.length}/300</span>}
              >
                <Textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Ej: La clase del martes a las 10:00 queda cancelada por obras en la pista."
                  maxLength={300}
                  rows={3}
                  className="resize-none"
                />
              </Field>
            </>
          )}

          {result && (
            result.ok ? (
              <Notice tone="success" icon={<CircleCheck />}>
                Enviado a {result.sent} dispositivo{result.sent !== 1 ? 's' : ''}
              </Notice>
            ) : (
              <p role="alert" className="text-meta font-medium text-danger-ink">No se ha podido enviar: {result.error}</p>
            )
          )}

          <Button
            block
            size="lg"
            onClick={handleSend}
            loading={sending}
            disabled={(!isAutoTarget && (!title.trim() || !body.trim())) || (target === 'level' && !levelId)}
          >
            {!sending && <Send className="h-4 w-4" aria-hidden />}
            {sending ? 'Enviando…' : 'Enviar notificación'}
          </Button>
        </CardBody>
      </Card>

      <p className="text-center text-meta text-ink-3">
        Solo recibirán la notificación los alumnos que hayan aceptado los permisos en el navegador.
      </p>
    </div>
  )
}
