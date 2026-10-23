import { PAYMENT_TYPE_LABELS } from '@/lib/payments-month'

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

interface PaymentLike {
  type: string | null
  status?: string | null
  created_at: string
  metadata?: {
    paid_until?: string | null
    items?: { paid_until?: string | null }[] | null
    advance?: boolean | null
    concept?: string | null
    class_date?: string | null
    pack_type?: string | null
    classes_per_pack?: number | string | null
  } | null
}

const FEE_TYPES = new Set(['fixed_group_month', 'mandate_charge'])

const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1]

// "octubre 2026", "septiembre y octubre 2026", "diciembre 2026 y enero 2027"
function monthsLabel(months: string[]): string {
  const years = new Set(months.map(m => m.slice(0, 4)))
  if (years.size === 1) {
    const names = months.map(monthName)
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
    return `${list} ${months[0].slice(0, 4)}`
  }
  const parts = months.map(m => `${monthName(m)} ${m.slice(0, 4)}`)
  return `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`
}

// Qué pagó, en palabras del club y del alumno. La cuota dice el mes que cubre
// (metadata.paid_until o el de cada grupo en metadata.items), no cuándo se
// pagó: un adelanto de noviembre pagado en octubre es "Cuota de noviembre".
export function paymentConcept(p: PaymentLike): { title: string; detail: string | null } {
  const meta = p.metadata ?? {}
  const type = p.type ?? ''

  if (FEE_TYPES.has(type)) {
    const items = meta.items ?? []
    const covered = [...new Set(
      (items.length ? items.map(i => i.paid_until) : [meta.paid_until])
        .filter((d): d is string => !!d)
        .map(d => d.slice(0, 7)),
    )].sort()
    const details = [
      items.length > 1 ? `${items.length} grupos` : null,
      meta.advance ? 'Adelantada' : null,
      type === 'mandate_charge' ? 'Pago automático' : null,
    ].filter(Boolean)
    // Un pago con tarjeta que no llegó a cobrarse no tiene mes: el mes se
    // apunta cuando el banco confirma.
    const unfinished = p.status === 'pending' ? 'Pago con tarjeta sin terminar' : p.status === 'failed' ? 'Pago con tarjeta rechazado' : null
    return {
      title: covered.length ? `Cuota de ${monthsLabel(covered)}` : unfinished ?? 'Cuota mensual',
      detail: details.length ? details.join(' · ') : null,
    }
  }

  if (type === 'manual_charge') return { title: 'Cargo suelto', detail: meta.concept ?? null }
  if (type === 'class_pack' || type === 'bag_pack') {
    const classes = meta.classes_per_pack ? `${meta.classes_per_pack} clases` : null
    const duration = meta.pack_type === '90' ? 'de 1 h 30' : meta.pack_type === '60' ? 'de 1 h' : null
    return { title: 'Bono de clases', detail: [classes, duration].filter(Boolean).join(' ') || null }
  }
  if ((type === 'single_class' || type === 'pay_per_class') && meta.class_date) {
    const [y, m, d] = meta.class_date.split('-').map(Number)
    return { title: 'Clase suelta', detail: `${d} de ${MONTHS[m - 1]} ${y}` }
  }
  return { title: PAYMENT_TYPE_LABELS[type] ?? 'Pago', detail: null }
}

// Un pago "pendiente" es un pago con tarjeta en marcha: si pasa una hora sin
// que el banco conteste, el alumno lo dejó a medias (no debe nada por él).
const UNFINISHED_AFTER_MS = 60 * 60 * 1000

export function paymentStatus(p: { status?: string | null; created_at: string }, now = Date.now()): { key: string; label: string } {
  switch (p.status) {
    case 'succeeded': return { key: 'succeeded', label: 'Cobrado' }
    case 'failed': return { key: 'failed', label: 'Fallido' }
    case 'refunded': return { key: 'refunded', label: 'Reembolsado' }
    case 'pending':
      return now - new Date(p.created_at).getTime() > UNFINISHED_AFTER_MS
        ? { key: 'unfinished', label: 'Sin terminar' }
        : { key: 'pending', label: 'En curso' }
    default: return { key: p.status ?? 'unknown', label: p.status ?? '—' }
  }
}
