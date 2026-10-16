'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface AutoPayState {
  available: boolean
  mandate: { id: string; status: string; day_of_month: number; next_charge_at: string | null } | null
  preview: {
    amount: number
    currentMonthName: string
    onlyNextMonth: boolean
    day: number
    items: { label: string; month: string; amount: number }[]
  }
}

const formatDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

export function StudentAutoPay() {
  const [state, setState] = useState<AutoPayState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const res = await fetch('/api/student/payment-mandate')
      if (res.ok) setState(await res.json())
    } catch {
      // Sin conexión: el recuadro simplemente no aparece.
    }
  }
  useEffect(() => { load() }, [])

  async function activate() {
    if (!state) return
    const { preview } = state
    const what = preview.onlyNextMonth
      ? `Estás al día, así que ahora se te cobrará la siguiente cuota de cada grupo (${preview.items.map(i => i.month).join(', ')}): ${formatCurrency(preview.amount)}.`
      : `Ahora se te cobrará lo que debes: ${formatCurrency(preview.amount)}.`
    if (!confirm(`${what} Después se cobrará solo cada día ${preview.day} de mes. ¿Continuar e ir a meter la tarjeta?`)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/student/payment-mandate', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'No se pudo activar el pago automático')
        setBusy(false)
        return
      }
      window.location.href = `/pay/mandate/${json.mandateId}`
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setBusy(false)
    }
  }

  async function cancel() {
    if (!confirm('¿Cancelar el pago automático? Tendrás que pagar tus cuotas a mano cada mes.')) return
    setBusy(true)
    const res = await fetch('/api/student/payment-mandate', { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) setError('No se pudo cancelar. Inténtalo de nuevo.')
    await load()
    setBusy(false)
  }

  if (!state?.available) return null
  const { mandate, preview } = state
  if (!mandate && !preview.items.length) return null

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-gray-900">Pago automático con tarjeta</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Guarda tu tarjeta y tus cuotas se cobrarán solas cada mes. La tarjeta la metes en la página segura del banco (Redsys); el club no la ve.
      </p>

      {mandate?.status === 'active' && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-700">
            <span className="mr-2 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Activado</span>
            {mandate.next_charge_at ? `Próximo cobro: ${formatDate(mandate.next_charge_at)}` : `Se cobra cada día ${mandate.day_of_month}`}
          </p>
          <button onClick={cancel} disabled={busy} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 sm:w-auto">
            Cancelar pago automático
          </button>
        </div>
      )}

      {mandate?.status === 'paused' && (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            El último cobro con tu tarjeta no se pudo hacer y el pago automático está pausado. Puedes volver a activarlo con otra tarjeta o pagar a mano.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={activate} disabled={busy || !preview.items.length} className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 sm:w-auto">
              Volver a activar
            </button>
            <button onClick={cancel} disabled={busy} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 sm:w-auto">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mandate?.status === 'pending_auth' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="w-full text-xs text-amber-700">Falta meter la tarjeta para terminar de activarlo.</p>
          <a href={`/pay/mandate/${mandate.id}`} className="w-full rounded-lg bg-brand-500 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-600 sm:w-auto">
            Meter la tarjeta
          </a>
          <button onClick={cancel} disabled={busy} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 sm:w-auto">
            Cancelar
          </button>
        </div>
      )}

      {!mandate && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            {preview.onlyNextMonth ? (
              <p>
                Estás al día con {preview.currentMonthName}. Al activarlo se te cobrará ahora la <strong>siguiente cuota</strong> de cada grupo:
              </p>
            ) : (
              <p>Al activarlo se te cobrará ahora lo que debes:</p>
            )}
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
              {preview.items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span>{i.label.charAt(0).toUpperCase() + i.label.slice(1)} · {i.month}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(i.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-semibold">
              <span>Total ahora</span>
              <span className="tabular-nums">{formatCurrency(preview.amount)}</span>
            </p>
            <p className="mt-2 text-xs text-gray-500">Después se cobrará solo cada día {preview.day} de mes la cuota de tus grupos. Lo que ya hayas pagado no se vuelve a cobrar.</p>
          </div>
          <button onClick={activate} disabled={busy} className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 sm:w-auto">
            {busy ? 'Un momento…' : 'Activar pago automático'}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
