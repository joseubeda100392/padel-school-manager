'use client'

import { useState } from 'react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { PAYMENT_METHODS, paymentMethodKey, type PaymentMethodKey } from '@/lib/payment-method'
import { CircleAlert, CircleCheck, Clock, Download, Receipt, Search, Undo2, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/feedback'

type StatusTone = 'success' | 'warn' | 'danger' | 'neutral'

function statusInfo(status: string): { tone: StatusTone; Icon: typeof CircleCheck } {
  if (status === 'completed' || status === 'succeeded') return { tone: 'success', Icon: CircleCheck }
  if (status === 'pending') return { tone: 'warn', Icon: Clock }
  if (status === 'failed') return { tone: 'danger', Icon: CircleAlert }
  return { tone: 'neutral', Icon: Undo2 }
}

const statusLabel: Record<string, string> = {
  completed: 'Completado',
  succeeded: 'Completado',
  pending:   'Pendiente',
  failed:    'Fallido',
  refunded:  'Reembolsado',
}

const typeLabel: Record<string, string> = {
  fixed_group_month: 'Cuota mensual',
  single_class:      'Clase suelta',
  class_pack:        'Bono de clases',
  pay_per_class:     'Clase suelta',
  subscription:      'Suscripción',
  bag_pack:          'Bono de clases',
  tournament:        'Inscripción torneo',
  intensivo_group:   'Semana intensiva',
  mandate_init:      'Activación domiciliación',
  mandate_charge:    'Cuota mensual (domiciliada)',
  manual:            'Manual',
}

function methodLabel(p: any): { label: string; cls: string } {
  return PAYMENT_METHODS[paymentMethodKey(p)]
}

const METHOD_FILTERS: PaymentMethodKey[] = ['online', 'cash', 'card_terminal']

function isPaid(p: any) {
  return p.status === 'completed' || p.status === 'succeeded'
}

// Códigos de respuesta de Redsys más comunes. Ojo: dentro del rango 9xxx
// ("SIS...") hay de todo — desde errores técnicos/de configuración reales
// (9064, 9093, 9104, 9912...) hasta estados totalmente normales que no son
// culpa de nadie (9915 = el propio alumno canceló el pago). No se puede
// asumir "9xxx = revisar configuración" sin más.
const REDSYS_REASON: Record<string, string> = {
  '0101': 'Tarjeta caducada',
  '0102': 'Tarjeta en excepción transitoria',
  '0104': 'Operación no permitida para esa tarjeta',
  '0116': 'Fondos insuficientes',
  '0118': 'Tarjeta no registrada',
  '0125': 'Tarjeta no efectiva',
  '0129': 'Código de seguridad (CVV) incorrecto',
  '0180': 'Tarjeta ajena al servicio',
  '0184': 'Error en la autenticación del titular',
  '0190': 'Denegación sin motivo especificado',
  '0191': 'Fecha de caducidad errónea',
  '0202': 'Tarjeta en excepción transitoria o bajo sospecha de fraude',
  '9064': 'Número de posiciones de la tarjeta incorrecto',
  '9078': 'No existe método de pago válido para esa tarjeta',
  '9093': 'Tarjeta no existente',
  '9094': 'Rechazo de servidores internacionales',
  '9104': 'El comercio tiene restricciones de titular seguro — revisar configuración',
  '9218': 'El comercio no permite operaciones seguras por entrada — revisar configuración',
  '9253': 'La tarjeta no cumple el check-digit',
  '9256': 'El comercio no puede realizar preautorizaciones — revisar configuración',
  '9257': 'Esta tarjeta no permite preautorizaciones',
  '9261': 'Operación detenida por control de restricciones',
  '9912': 'Emisor no disponible — reintentar más tarde',
  '9913': 'Error en la confirmación del comercio',
  '9914': 'Confirmación rechazada por el comercio',
  '9915': 'El alumno canceló el pago antes de terminarlo',
  '9928': 'Anulado automáticamente (proceso de Redsys)',
  '9929': 'Anulado por el comercio',
  '9997': 'Ya había otra operación en curso con esa misma tarjeta',
  '9998': 'Operación en proceso de solicitud de datos de tarjeta',
  '9999': 'Operación redirigida al banco para autenticar',
}
function redsysReason(code: string | undefined): string {
  if (!code) return ''
  if (REDSYS_REASON[code]) return REDSYS_REASON[code]
  const n = parseInt(code, 10)
  if (n >= 100 && n < 900) return `Rechazado por el banco (código ${code})`
  return `Código de Redsys ${code} (sin descripción registrada)`
}

export default function PaymentsTable({ payments }: { payments: any[] }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState<PaymentMethodKey | ''>('')

  const filtered = payments.filter((p) => {
    const matchQ = !q ||
      p.user?.name?.toLowerCase().includes(q.toLowerCase()) ||
      p.user?.email?.toLowerCase().includes(q.toLowerCase())
    const matchStatus = !status || p.status === status || (status === 'completed' && p.status === 'succeeded')
    const matchMethod = !method || paymentMethodKey(p) === method
    return matchQ && matchStatus && matchMethod
  })

  function exportCSV() {
    const headers = ['Alumno', 'Email', 'Tipo', 'Método', 'Importe (€)', 'Estado', 'Fecha']
    const rows = filtered.map((p) => [
      p.user?.name ?? '',
      p.user?.email ?? '',
      typeLabel[p.type] ?? p.type,
      methodLabel(p).label,
      (p.amount / 100).toFixed(2),
      statusLabel[p.status] ?? p.status,
      formatDate(p.created_at),
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'pagos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const total = filtered.reduce((acc, p) => isPaid(p) ? acc + p.amount : acc, 0)

  const hasFilters = !!(q || status || method)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <label htmlFor="payments-search" className="sr-only">Buscar por alumno o email</label>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input
            id="payments-search"
            type="search"
            placeholder="Buscar por alumno o email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10"
          />
        </div>
        <Field label="Estado" className="w-full sm:w-auto">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="completed">Completados</option>
            <option value="pending">Pendientes</option>
            <option value="failed">Fallidos</option>
            <option value="refunded">Reembolsados</option>
          </Select>
        </Field>
        <Field label="Método" className="w-full sm:w-auto">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodKey | '')}>
            <option value="">Todos los métodos</option>
            {METHOD_FILTERS.map((m) => (
              <option key={m} value={m}>{PAYMENT_METHODS[m].label}</option>
            ))}
          </Select>
        </Field>
        {hasFilters && (
          <Button variant="ghost" onClick={() => { setQ(''); setStatus(''); setMethod('') }}>
            <X className="h-4 w-4" aria-hidden />
            Limpiar filtros
          </Button>
        )}
        <Button variant="secondary" onClick={exportCSV}>
          <Download className="h-4 w-4" aria-hidden />
          Descargar CSV
        </Button>
      </div>

      <p className="text-meta tabular-nums text-ink-3" aria-live="polite">
        {filtered.length} de {payments.length} transacciones
        {filtered.length > 0 && (
          <span className="ml-2 text-label text-ink-2">· Total filtrado: {formatCurrency(total)}</span>
        )}
      </p>

      <Card className="overflow-hidden">
        {!filtered.length ? (
          <EmptyState
            icon={<Receipt />}
            title={hasFilters ? 'Sin resultados' : 'Aún no hay pagos'}
            description={hasFilters ? 'Prueba con otra búsqueda o quita algún filtro.' : 'Los pagos de este mes aparecerán aquí.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-meta font-medium text-ink-3">
                  <th scope="col" className="px-4 py-3 sm:px-5">Alumno</th>
                  <th scope="col" className="px-4 py-3">Tipo</th>
                  <th scope="col" className="px-4 py-3">Método</th>
                  <th scope="col" className="px-4 py-3 text-right">Importe</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3 sm:px-5">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((p) => {
                  const methodInfo = methodLabel(p)
                  const st = statusInfo(p.status)
                  const failReason = p.status === 'failed' ? redsysReason(p.metadata?.redsys_response_code) : ''
                  return (
                    <tr key={p.id} className="hover:bg-ink/[0.03]">
                      <td className="px-4 py-3 sm:px-5">
                        <p className="text-label text-ink">{p.user?.name ?? '—'}</p>
                        <p className="text-meta text-ink-3">{p.user?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-body text-ink-2">{typeLabel[p.type] ?? p.type}</td>
                      <td className="px-4 py-3">
                        <Badge tone="outline">{methodInfo.label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-label tabular-nums text-ink">
                        {formatCurrency(p.amount, p.currency ?? 'EUR')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={st.tone} title={failReason || undefined} className={failReason ? 'cursor-help' : undefined}>
                          <st.Icon className="h-3.5 w-3.5" aria-hidden />
                          {statusLabel[p.status] ?? p.status}
                        </Badge>
                        {failReason && <p className="mt-1 max-w-[220px] text-meta text-ink-3">{failReason}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-body tabular-nums text-ink-2 sm:px-5">{formatDate(p.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
