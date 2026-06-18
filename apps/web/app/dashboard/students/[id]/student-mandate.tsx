'use client'

import { useState, useEffect, useRef } from 'react'

interface Mandate {
  id: string
  amount_cents: number
  day_of_month: number
  status: string
  last_charged_at: string | null
  next_charge_at: string | null
}

const statusLabel: Record<string, string> = {
  pending_auth: 'Pendiente de autorización',
  active: 'Activa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

const statusColor: Record<string, string> = {
  pending_auth: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

export function StudentMandate({ studentId }: { studentId: string }) {
  const [mandate, setMandate] = useState<Mandate | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [payLink, setPayLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function loadMandate() {
    const res = await fetch(`/api/admin/payment-mandates?userId=${studentId}`)
    const json = await res.json()
    const active = (json.mandates ?? []).find((m: Mandate) => m.status !== 'cancelled')
    setMandate(active ?? null)
    setLoading(false)
  }

  useEffect(() => { loadMandate() }, [studentId])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/admin/payment-mandates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: studentId, amountCents: Math.round(parseFloat(amount) * 100), dayOfMonth: parseInt(day) }),
    })
    const json = await res.json()
    if (!res.ok) { setSubmitting(false); return }

    // Construir URL de pago para enviar al alumno
    const payUrl = buildRedsysUrl(json)
    setPayLink(payUrl)
    setShowForm(false)
    setSubmitting(false)
    loadMandate()
  }

  async function handlePause() {
    if (!mandate) return
    await fetch(`/api/admin/payment-mandates/${mandate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: mandate.status === 'paused' ? 'active' : 'paused' }),
    })
    loadMandate()
  }

  async function handleCancel() {
    if (!mandate || !confirm('¿Cancelar la domiciliación de este alumno?')) return
    await fetch(`/api/admin/payment-mandates/${mandate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    setMandate(null)
    loadMandate()
  }

  if (loading) return null

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">Domiciliación mensual</h2>
          <p className="text-xs text-gray-400">Cobro recurrente via Redsys</p>
        </div>
        {!mandate && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Activar
          </button>
        )}
      </div>

      {payLink && (
        <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="mb-2 text-sm font-medium text-brand-700">Enlace de pago generado — envíaselo al alumno:</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={payLink}
              className="flex-1 truncate rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none"
            />
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(payLink)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              }}
              className="shrink-0 rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-600"
            >
              {linkCopied ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="mt-2 text-xs text-brand-600">El enlace caduca cuando el alumno completa el pago o se regenera.</p>
        </div>
      )}

      {mandate && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor[mandate.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {statusLabel[mandate.status] ?? mandate.status}
            </span>
            <span className="text-sm font-medium text-gray-900">
              {(mandate.amount_cents / 100).toFixed(2)} € / mes · día {mandate.day_of_month}
            </span>
          </div>
          {mandate.last_charged_at && (
            <p className="text-xs text-gray-400">
              Último cobro: {new Date(mandate.last_charged_at).toLocaleDateString('es-ES')}
            </p>
          )}
          {mandate.next_charge_at && mandate.status === 'active' && (
            <p className="text-xs text-gray-400">
              Próximo cobro: {new Date(mandate.next_charge_at + 'T12:00:00Z').toLocaleDateString('es-ES')}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            {mandate.status !== 'pending_auth' && (
              <button
                onClick={handlePause}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {mandate.status === 'paused' ? 'Reactivar' : 'Pausar'}
              </button>
            )}
            <button
              onClick={handleCancel}
              className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
            >
              Cancelar domiciliación
            </button>
          </div>
        </div>
      )}

      {showForm && !mandate && (
        <form onSubmit={handleCreate} className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Importe mensual (€)</label>
            <input
              type="number"
              step="0.01"
              min="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              placeholder="60.00"
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Día de cobro</label>
            <select
              value={day}
              onChange={e => setDay(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>Día {d}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400">
            Se generará un enlace de pago para enviar al alumno. Al pagarlo, la tarjeta queda vinculada y los cobros son automáticos.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {submitting ? 'Generando...' : 'Generar enlace'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function buildRedsysUrl(json: { redsysUrl: string; merchantParameters: string; signature: string }): string {
  // Construye la URL completa de pago de Redsys con los parámetros como query string
  // El alumno al abrirla verá el TPV de Redsys directamente
  const params = new URLSearchParams({
    Ds_SignatureVersion: 'HMAC_SHA256_V1',
    Ds_MerchantParameters: json.merchantParameters,
    Ds_Signature: json.signature,
  })
  return `${json.redsysUrl}?${params.toString()}`
}
