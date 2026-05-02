'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function NotificationsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [filterLevelId, setFilterLevelId] = useState('')
  const [levels, setLevels] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; sent?: number; error?: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('levels').select('id, name, color').order('name'),
      supabase.from('push_campaigns').select('*, level:levels(name), sender:users!push_campaigns_sent_by_fkey(name)').order('created_at', { ascending: false }).limit(20),
    ]).then(([{ data: lvls }, { data: camps }]) => {
      setLevels(lvls ?? [])
      setCampaigns(camps ?? [])
    })
  }, [])

  async function handleSend() {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    setResult(null)

    const res = await fetch('/api/admin/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, filterLevelId: filterLevelId || null }),
    })
    const json = await res.json()

    if (res.ok) {
      setResult({ ok: true, sent: json.sent })
      setTitle('')
      setBody('')
      setFilterLevelId('')
      // Recargar historial
      const supabase = createClient()
      const { data } = await supabase
        .from('push_campaigns')
        .select('*, level:levels(name), sender:users!push_campaigns_sent_by_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(20)
      setCampaigns(data ?? [])
    } else {
      setResult({ ok: false, error: json.error })
    }
    setSending(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
        <p className="text-sm text-gray-500">Envía un aviso push a tus alumnos al instante</p>
      </div>

      {/* Formulario de envío */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Nueva notificación</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: ¡Clase cancelada mañana!"
              maxLength={100}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Mensaje</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ej: La clase del martes a las 10h queda cancelada. Disculpad las molestias."
              maxLength={300}
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{body.length}/300</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Destinatarios</label>
            <select
              value={filterLevelId}
              onChange={(e) => setFilterLevelId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="">Todos los alumnos</option>
              {levels.map((l: any) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {result && (
            <div className={`rounded-lg px-4 py-3 text-sm ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {result.ok
                ? `✓ Enviado a ${result.sent} dispositivo${result.sent !== 1 ? 's' : ''}`
                : `Error: ${result.error}`}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {sending ? 'Enviando...' : 'Enviar notificación'}
          </button>
        </div>
      </div>

      {/* Historial */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Historial de envíos</h2>
        </div>
        {campaigns.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">Aún no has enviado ninguna notificación.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {campaigns.map((c: any) => (
              <div key={c.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{c.title}</p>
                    <p className="mt-0.5 text-sm text-gray-500">{c.body}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span>
                        {new Date(c.created_at).toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {c.level && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                          Nivel: {c.level.name}
                        </span>
                      )}
                      {c.sender && <span>por {c.sender.name}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                    {c.sent_count} enviados
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
