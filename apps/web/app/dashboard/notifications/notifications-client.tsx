'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Target = 'all' | 'level' | 'payment_pending'

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
    createClient().from('levels').select('id, name, color').order('order').then(({ data }) => {
      setLevels(data ?? [])
    })
  }, [])

  async function handleSend() {
    if (target !== 'payment_pending' && (!title.trim() || !body.trim())) return
    setSending(true)
    setResult(null)

    const payload =
      target === 'payment_pending'
        ? { title: '💳 Cuota pendiente de pago', body: 'Tienes una cuota mensual sin pagar. Entra en la app para regularizarla.', target, url: '/student/schedule' }
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
      if (res.ok && target !== 'payment_pending') {
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
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notificaciones push</h1>
        <p className="text-sm text-gray-500">Envía mensajes a los alumnos que hayan activado las notificaciones</p>
      </div>

      {/* Acción rápida: recordatorio de pago */}
      {enablePayments && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-orange-800">Recordatorio de cuota</p>
              <p className="mt-1 text-sm text-orange-700">
                Envía un push a todos los alumnos con cuota mensual sin pagar.
              </p>
            </div>
            <button
              onClick={() => { setTarget('payment_pending'); setTitle(''); setBody('') }}
              className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
            >
              Seleccionar
            </button>
          </div>
        </div>
      )}

      {/* Formulario */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Nueva notificación</h2>
        <div className="space-y-4">

          {/* Target selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Destinatarios</label>
            <div className="flex flex-wrap gap-2">
              {targetOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTarget(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    target === opt.value
                      ? 'bg-green-600 text-white'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {target === 'level' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Nivel</label>
              <select
                value={levelId}
                onChange={e => setLevelId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none"
              >
                <option value="">Selecciona un nivel</option>
                {levels.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          {target === 'payment_pending' ? (
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
              <p className="font-medium">Mensaje automático:</p>
              <p className="mt-1">💳 Cuota pendiente de pago</p>
              <p className="text-xs text-gray-500">Tienes una cuota mensual sin pagar. Entra en la app para regularizarla.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej: ¡Clase cancelada mañana!"
                  maxLength={100}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Mensaje</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Ej: La clase del martes a las 10h queda cancelada por obras en la pista."
                  maxLength={300}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{body.length}/300</p>
              </div>
            </>
          )}

          {result && (
            <div className={`rounded-lg px-4 py-3 text-sm ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {result.ok
                ? `✓ Enviado a ${result.sent} dispositivo${result.sent !== 1 ? 's' : ''}`
                : `Error: ${result.error}`}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending || (target !== 'payment_pending' && (!title.trim() || !body.trim())) || (target === 'level' && !levelId)}
            className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {sending ? 'Enviando...' : '🔔 Enviar notificación'}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        Solo recibirán la notificación los alumnos que hayan aceptado los permisos en el navegador.
      </p>
    </div>
  )
}
