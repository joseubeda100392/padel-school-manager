import type { SupabaseClient } from '@supabase/supabase-js'
import { nextPaidUntilForEnrollment, dateStr } from '@/lib/billing-cycle'
import { resetEnrollmentDiscountAfterPayment } from '@/lib/enrollment-discount'

export interface MandateEnrollment {
  id: string
  monthly_price: number
  paid_until: string | null
  start_date: string | null
  end_date?: string | null
  replaces_enrollment_id?: string | null
  price_per_class_cents: number | null
  discount_classes_pending: number | null
}

// Lo que paga un cobro de pago automático con tarjeta, grupo a grupo. Se
// guarda en payments.metadata.items para saber exactamente qué mes de qué
// grupo cubrió cada cargo.
export interface MandateItem {
  enrollment_id: string
  amount: number
  paid_until: string
  discount_cents: number
}

// - 'monthly' (cobro mensual): los meses que deba cada grupo hasta el actual
//   (un item por grupo y mes). Uno ya pagado (en efectivo, adelantado...) no
//   se cobra.
// - 'init' (alta del pago automático): lo mismo; y si no debe nada, la
//   cuota del mes siguiente de cada grupo, porque Redsys necesita un primer
//   cobro para guardar la tarjeta.
// Cada grupo avanza un mes desde lo que YA tiene pagado, nunca se le pone
// "fin de este mes" a todos a la vez: eso daba por pagados los grupos de un
// alumno que va a varios con un solo cobro, y pisaba los adelantos.
export function planMandateItems(params: {
  enrollments: MandateEnrollment[]
  mode: 'init' | 'monthly'
  currentMonth: string
  classValidation: boolean
}): MandateItem[] {
  const { enrollments, mode, currentMonth, classValidation } = params
  const due = buildItems(enrollments, currentMonth, classValidation, true)
  if (mode === 'monthly' || due.length) return due
  return buildItems(enrollments, currentMonth, classValidation, false)
}

// Tope de meses atrasados que se cobran de golpe a un mismo grupo (por si
// alguien lleva muchísimo sin pagar; el resto quedaría pendiente a la vista).
const MAX_CATCHUP_MONTHS = 12

function buildItems(enrollments: MandateEnrollment[], currentMonth: string, classValidation: boolean, onlyDue: boolean): MandateItem[] {
  const items: MandateItem[] = []
  for (const e of enrollments) {
    if (e.monthly_price <= 0) continue
    // Un grupo que deja (baja o cambio de grupo programado) no se cobra de
    // los meses en que ya no está.
    const staysIn = (paidUntil: string) => !e.end_date || e.end_date >= paidUntil.slice(0, 7) + '-01'
    const pending = e.discount_classes_pending ?? 0
    const discount = classValidation && e.price_per_class_cents && pending > 0
      ? Math.min(e.monthly_price, pending * e.price_per_class_cents)
      : 0

    if (!onlyDue) {
      const paidUntil = nextPaidUntilForEnrollment(e.paid_until, e.start_date)
      if (!staysIn(paidUntil)) continue
      items.push({ enrollment_id: e.id, amount: e.monthly_price - discount, paid_until: paidUntil, discount_cents: discount })
      continue
    }

    // Todos los meses que deba hasta el actual, no solo uno: si no, un grupo
    // que empieza con un mes pendiente (p. ej. se une a mitad de mes) se
    // quedaba un mes por detrás para siempre.
    let paidUntil = e.paid_until
    for (let i = 0; i < MAX_CATCHUP_MONTHS; i++) {
      const next = nextPaidUntilForEnrollment(paidUntil, e.start_date)
      if (next.slice(0, 7) > currentMonth || !staysIn(next)) break
      const monthDiscount = i === 0 ? discount : 0
      items.push({ enrollment_id: e.id, amount: e.monthly_price - monthDiscount, paid_until: next, discount_cents: monthDiscount })
      paidUntil = next
    }
  }
  return items
}

function addMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

// Adelantar el mes siguiente de TODOS sus grupos a la vez: solo si no debe
// nada (todos tienen pagado el mes en curso). Solo entran los grupos que aún
// no tienen pagado el mes siguiente.
export function planAdvanceItems(params: {
  enrollments: MandateEnrollment[]
  currentMonth: string
  classValidation: boolean
}): MandateItem[] {
  const { enrollments, currentMonth, classValidation } = params
  if (buildItems(enrollments, currentMonth, classValidation, true).length) return []
  const nextMonth = addMonth(currentMonth)
  return buildItems(enrollments, currentMonth, classValidation, false)
    .filter(i => i.paid_until.slice(0, 7) === nextMonth)
}

export const madridMonth = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d).slice(0, 7)

// Próximo día de cobro estrictamente posterior a hoy (hora de Madrid).
export function nextChargeDate(dayOfMonth: number, today: Date = new Date()): string {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(today).split('-').map(Number)
  return d < dayOfMonth ? dateStr(y, m - 1, dayOfMonth) : dateStr(y, m, dayOfMonth)
}

async function loadFeeContext(admin: SupabaseClient, userId: string, clubId: string) {
  const [{ data: enrollments, error }, { data: club }] = await Promise.all([
    admin
      .from('group_enrollments')
      .select('id, monthly_price, paid_until, start_date, end_date, replaces_enrollment_id, price_per_class_cents, discount_classes_pending')
      .eq('student_id', userId)
      .eq('club_id', clubId)
      .eq('status', 'active'),
    admin.from('clubs').select('features').eq('id', clubId).single(),
  ])
  if (error) throw new Error(error.message)
  const list = (enrollments ?? []) as MandateEnrollment[]
  // Lo pagado en la inscripción a la que sustituye (aunque ya haya terminado).
  const prevIds = list.map(e => e.replaces_enrollment_id).filter((x): x is string => !!x)
  const { data: prev } = prevIds.length
    ? await admin.from('group_enrollments').select('id, paid_until').in('id', prevIds).eq('student_id', userId)
    : { data: [] as { id: string; paid_until: string | null }[] }
  return {
    enrollments: withReplacements(list, new Map((prev ?? []).map(p => [p.id, p.paid_until]))),
    classValidation: !!(club as any)?.features?.enable_class_validation,
  }
}

// Cuando un alumno pasa de una inscripción a otra suya (cambio de grupo, o
// clase editada a partir de un día), cada mes se cobra una sola vez: la vieja
// solo hasta el mes anterior al inicio de la nueva, y lo pagado en la vieja
// vale para la nueva. Mismo criterio que get_pending_payments.
export function withReplacements(enrollments: MandateEnrollment[], prevPaidUntil: Map<string, string | null>): MandateEnrollment[] {
  return enrollments.map(e => {
    const next = enrollments.filter(n => n.replaces_enrollment_id === e.id && n.start_date)
    const nextStart = next.map(n => n.start_date as string).sort()[0]
    const cap = nextStart ? dateStr(Number(nextStart.slice(0, 4)), Number(nextStart.slice(5, 7)) - 1, 0) : null
    const endDate = cap && (!e.end_date || cap < e.end_date) ? cap : e.end_date ?? null
    const prevPaid = e.replaces_enrollment_id ? prevPaidUntil.get(e.replaces_enrollment_id) ?? null : null
    const paidUntil = prevPaid && (!e.paid_until || prevPaid > e.paid_until) ? prevPaid : e.paid_until
    return { ...e, end_date: endDate, paid_until: paidUntil }
  })
}

// Cuotas de todos los grupos del alumno en un solo pago: 'due' = lo que debe
// hasta el mes en curso; 'advance' = el mes siguiente de cada grupo.
export async function loadStudentFeeItems(
  admin: SupabaseClient,
  params: { userId: string; clubId: string; kind: 'due' | 'advance' },
): Promise<MandateItem[]> {
  const { enrollments, classValidation } = await loadFeeContext(admin, params.userId, params.clubId)
  const currentMonth = madridMonth()
  return params.kind === 'due'
    ? planMandateItems({ enrollments, mode: 'monthly', currentMonth, classValidation })
    : planAdvanceItems({ enrollments, currentMonth, classValidation })
}

export async function loadMandateItems(
  admin: SupabaseClient,
  params: { userId: string; clubId: string; mode: 'init' | 'monthly' },
): Promise<MandateItem[]> {
  const { enrollments, classValidation } = await loadFeeContext(admin, params.userId, params.clubId)
  return planMandateItems({ enrollments, mode: params.mode, currentMonth: madridMonth(), classValidation })
}

// Marca como pagado lo que cubrió un cobro ya confirmado. Si mientras tanto
// el grupo ya se pagó por otra vía hasta esa fecha o más, no se toca (nunca
// se retrocede un "pagado hasta").
export async function applyMandateItems(admin: SupabaseClient, userId: string, items: MandateItem[]): Promise<void> {
  for (const item of items) {
    const { data: current } = await admin
      .from('group_enrollments')
      .select('paid_until')
      .eq('id', item.enrollment_id)
      .eq('student_id', userId)
      .maybeSingle()
    if (!current) continue
    if (!current.paid_until || current.paid_until < item.paid_until) {
      const update: Record<string, unknown> = { paid_until: item.paid_until }
      if (item.discount_cents > 0) update.discount_classes_pending = 0
      const { error } = await admin.from('group_enrollments').update(update).eq('id', item.enrollment_id).eq('student_id', userId)
      if (error) throw new Error(error.message)
    }
    try {
      await resetEnrollmentDiscountAfterPayment(admin, item.enrollment_id)
    } catch (err) {
      console.error('[mandate] resetEnrollmentDiscountAfterPayment failed:', err)
    }
  }
}
