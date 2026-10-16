export interface AuditEnrollment {
  student_id: string
  student_name: string
  club_id: string
  start_date: string | null
  enrolled_at: string
  paid_until: string | null
  monthly_price: number
}

export interface AuditPayment {
  user_id: string
  club_id: string | null
  created_at: string
  metadata: { paid_until?: string | null; advance?: boolean | null; items?: { paid_until: string }[] | null } | null
}

export interface AuditClub {
  name: string
  billing_start_date: string | null
}

export type DiscrepancyKind = 'cubierto_sin_pago' | 'pago_sin_reflejar'

export interface BillingDiscrepancy {
  club_id: string
  club_name: string
  student_id: string
  student_name: string
  kind: DiscrepancyKind
  months: string[]
  paid_until: string | null
  payments: number
}

const madridMonth = (iso: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(iso)).slice(0, 7)

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let m = from; m <= to; m = nextMonth(m)) out.push(m)
  return out
}

// Mes que cubre un pago de cuota, cuando el propio pago lo dice: el
// paid_until guardado al cobrar o, en los adelantos anteriores a ese campo,
// el mes siguiente al cobro. Los pagos más antiguos no guardan ninguno de los
// dos (null) y se reparten aparte, al primer mes pendiente.
function explicitPaymentMonth(p: AuditPayment): string | null {
  if (p.metadata?.paid_until) return p.metadata.paid_until.slice(0, 7)
  if (p.metadata?.advance) return nextMonth(madridMonth(p.created_at))
  return null
}

function enrollmentFirstMonth(e: AuditEnrollment, club: AuditClub | undefined): string {
  const start = (e.start_date ?? madridMonth(e.enrolled_at)).slice(0, 7)
  const billingStart = club?.billing_start_date?.slice(0, 7)
  return billingStart && billingStart > start ? billingStart : start
}

// Compara, por alumno y club, los meses que la app da por pagados (paid_until
// de sus inscripciones activas) con los pagos de cuota que existen de verdad.
// Un alumno en dos grupos a la vez necesita dos pagos ese mes.
export function findBillingDiscrepancies(
  enrollments: AuditEnrollment[],
  payments: AuditPayment[],
  clubs: Record<string, AuditClub>,
): BillingDiscrepancy[] {
  const groups = new Map<string, AuditEnrollment[]>()
  for (const e of enrollments) {
    if (!clubs[e.club_id]) continue
    const key = `${e.club_id}|${e.student_id}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }

  // Se cuenta por alumno y club, no por inscripción: al cambiar de grupo el
  // pago se queda con el enrollment_id del grupo antiguo. Un pago de 0 € es
  // un mes saldado igual (cuota que entonces era 0, descuento total).
  const paymentsByKey = new Map<string, AuditPayment[]>()
  // Un cobro automático con tarjeta puede pagar varios grupos a la vez
  // (metadata.items): cuenta como un pago por cada grupo y mes que cubrió.
  for (const p of payments) {
    if (!p.club_id) continue
    const key = `${p.club_id}|${p.user_id}`
    const parts = Array.isArray(p.metadata?.items) && p.metadata.items.length
      ? p.metadata.items.map(i => ({ ...p, metadata: { paid_until: i.paid_until } }))
      : [p]
    paymentsByKey.set(key, [...(paymentsByKey.get(key) ?? []), ...parts])
  }

  const result: BillingDiscrepancy[] = []
  for (const [key, list] of groups) {
    const club = clubs[list[0].club_id]
    const charged = list.filter(e => e.monthly_price > 0)
    if (!charged.length) continue

    const needed = new Map<string, number>()
    let maxPaidUntil: string | null = null
    for (const e of charged) {
      if (!e.paid_until) continue
      if (!maxPaidUntil || e.paid_until > maxPaidUntil) maxPaidUntil = e.paid_until
      for (const m of monthsBetween(enrollmentFirstMonth(e, club), e.paid_until.slice(0, 7))) {
        needed.set(m, (needed.get(m) ?? 0) + 1)
      }
    }

    const studentPayments = (paymentsByKey.get(key) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at))
    const paid = new Map<string, number>()
    const legacy: AuditPayment[] = []
    for (const p of studentPayments) {
      const m = explicitPaymentMonth(p)
      if (m) paid.set(m, (paid.get(m) ?? 0) + 1)
      else legacy.push(p)
    }
    for (const p of legacy) {
      const pending = [...needed.keys()].sort().find(m => (paid.get(m) ?? 0) < (needed.get(m) ?? 0))
      const m = pending ?? madridMonth(p.created_at)
      paid.set(m, (paid.get(m) ?? 0) + 1)
    }

    const base = {
      club_id: list[0].club_id,
      club_name: club.name,
      student_id: list[0].student_id,
      student_name: list[0].student_name,
      paid_until: maxPaidUntil,
      payments: studentPayments.length,
    }

    const uncovered = [...needed].filter(([m, n]) => (paid.get(m) ?? 0) < n).map(([m]) => m).sort()
    if (uncovered.length) result.push({ ...base, kind: 'cubierto_sin_pago', months: uncovered })

    // Pago de un mes que ninguna inscripción activa da por pagado: típico de
    // un cobro que entró pero no llegó a actualizar paid_until.
    const firstMonth = charged.map(e => enrollmentFirstMonth(e, club)).sort()[0]
    const lastCovered = maxPaidUntil?.slice(0, 7) ?? null
    const unreflected = [...paid.keys()]
      .filter(m => m >= firstMonth && (!lastCovered || m > lastCovered))
      .sort()
    if (unreflected.length) result.push({ ...base, kind: 'pago_sin_reflejar', months: unreflected })
  }

  return result.sort((a, b) => a.club_name.localeCompare(b.club_name) || a.student_name.localeCompare(b.student_name))
}
