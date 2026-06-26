'use client'

import { useState, useEffect } from 'react'

const statusBadge: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  sent:      'bg-blue-100 text-blue-700',
  converted: 'bg-green-100 text-green-700',
  closed:    'bg-red-100 text-red-600',
}

const statusLabel: Record<string, string> = {
  draft:     'Borrador',
  sent:      'Enviada',
  converted: 'Convertida ✓',
  closed:    'Cerrada',
}

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const [campaign, setCampaign] = useState<any>(null)
  const [levels, setLevels] = useState<any[]>([])
  const [selectedLevel, setSelectedLevel] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; waSent?: number; pushSent?: number; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/pista-viva/campaigns?id=${params.id}`)
      .then((r) => r.json())
      .catch(() => {})

    // Load campaign from the list
    fetch('/api/admin/pista-viva/campaigns')
      .then((r) => r.json())
      .then((d) => {
        const found = (d.campaigns ?? []).find((c: any) => c.id === params.id)
        if (found) { setCampaign(found); setSelectedLevel(found.target_level_id ?? '') }
      })

    fetch('/api/admin/levels')
      .then((r) => r.json())
      .then((d) => setLevels(d.levels ?? []))
  }, [params.id])

  async function saveChanges() {
    setSaving(true)
    await fetch('/api/admin/pista-viva/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: params.id, targetLevelId: selectedLevel || null }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSend() {
    if (!confirm('¿Crear el partido en Playtomic y enviar WhatsApp + Push a los socios? Esta acción no se puede deshacer.')) return
    setSending(true)
    setSendResult(null)
    try {
      if (selectedLevel !== (campaign?.target_level_id ?? '')) {
        await fetch('/api/admin/pista-viva/campaigns', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: params.id, targetLevelId: selectedLevel || null }),
        })
      }

      const res = await fetch(`/api/admin/pista-viva/campaigns/${params.id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setSendResult({ ok: false, error: data.error }); return }
      setSendResult({ ok: true, waSent: data.waSent, pushSent: data.pushSent })
      setCampaign((prev: any) => ({ ...prev, status: 'sent', playtomic_match_url: data.matchUrl }))
    } catch {
      setSendResult({ ok: false, error: 'Error de conexión' })
    } finally {
      setSending(false)
    }
  }

  function copyLink() {
    const url = attributionUrl
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    } else {
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!campaign) return <div className="p-8 text-center text-gray-400">Cargando...</div>

  const slotDate = new Date(campaign.slot_datetime)
  const dateStr = slotDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = slotDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const attributionUrl = `${baseUrl}/pv/${params.id}`

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <a href="/dashboard/pista-viva" className="text-sm text-gray-500 hover:text-gray-700">← Pista Viva</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">{campaign.court_name}</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge[campaign.status] ?? ''}`}>
          {statusLabel[campaign.status] ?? campaign.status}
        </span>
      </div>

      {/* Info del slot */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Fecha y hora</p>
            <p className="font-medium text-gray-900">{dateStr} · {timeStr}</p>
          </div>
          <div>
            <p className="text-gray-400">Duración</p>
            <p className="font-medium text-gray-900">{campaign.duration_minutes} min</p>
          </div>
          <div>
            <p className="text-gray-400">Jugadores</p>
            <p className="font-medium text-gray-900">{campaign.players_joined} / {campaign.players_needed}</p>
          </div>
          <div>
            <p className="text-gray-400">Clics en enlace</p>
            <p className="font-medium text-gray-900">{campaign.click_count}</p>
          </div>
        </div>
      </div>

      {/* Link de atribución — solo visible una vez enviada */}
      {campaign.status !== 'draft' && <div className="rounded-xl bg-white p-6 shadow-sm">
        <p className="mb-2 text-sm font-medium text-gray-700">Enlace de atribución</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={attributionUrl}
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-600"
          />
          <button
            onClick={copyLink}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        {campaign.playtomic_match_url && (
          <p className="mt-2 text-xs text-gray-400">
            Partido en Playtomic:{' '}
            <a href={campaign.playtomic_match_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
              Ver partido →
            </a>
          </p>
        )}
      </div>}

      {/* Enviar campaña (solo si draft) */}
      {campaign.status === 'draft' && (
        <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Enviar campaña</h2>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Nivel objetivo (opcional — vacío = todos los socios)
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">Todos los socios</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveChanges}
              disabled={saving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          </div>

          {sendResult && !sendResult.ok && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{sendResult.error}</div>
          )}
          {sendResult?.ok && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              ¡Enviado! WhatsApp: {sendResult.waSent} · Push: {sendResult.pushSent}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {sending ? 'Creando partido y enviando...' : '⚡ Crear partido y enviar WhatsApp + Push'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            PSM creará un partido abierto en Playtomic y notificará a los socios con el link directo.
          </p>
        </div>
      )}
    </div>
  )
}
