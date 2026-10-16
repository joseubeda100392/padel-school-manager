import type { SupabaseClient } from '@supabase/supabase-js'
import { nextPaidUntilForEnrollment, dateStr } from '@/lib/billing-cycle'
import { resetEnrollmentDiscountAfterPayment } from '@/lib/enrollment-discount'

export interface MandateEnrollment {
  id: string
  monthly_price: number
  paid_until: string | null
  start_date: string | null
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

// - 'monthly' (cobro mensual): solo los grupos que deben el mes en curso o
//   uno anterior. Uno ya pagado (en efectivo, adelantado...) no se cobra.
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

function buildItems(enrollments: MandateEnrollment[], currentMonth: string, classValidation: boolean, onlyDue: boolean): MandateItem[] {
  const items: MandateItem[] = []
  for (const e of enrollments) {
    if (e.monthly_price <= 0) continue
    const paidUntil = nextPaidUntilForEnrollment(e.paid_until, e.start_date)
    if (onlyDue && paidUntil.slice(0, 7) > currentMonth) continue
    const pending = e.discount_classes_pending ?? 0
    const discount = classValidation && e.price_per_class_cents && pending > 0
      ? Math.min(e.monthly_price, pending * e.price_per_class_cents)
      : 0
    items.push({ enrollment_id: e.id, amount: e.monthly_price - discount, paid_until: paidUntil, discount_cents: discount })
  }
  return items
}

export const madridMonth = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d).slice(0, 7)

// Próximo día de cobro estrictamente posterior a hoy (hora de Madrid).
export function nextChargeDate(dayOfMonth: number, today: Date = new Date()): string {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(today).split('-').map(Number)
  return d < dayOfMonth ? dateStr(y, m - 1, dayOfMonth) : dateStr(y, m, dayOfMonth)
}

export async function loadMandateItems(
  admin: SupabaseClient,
  params: { userId: string; clubId: string; mode: 'init' | 'monthly' },
): Promise<MandateItem[]> {
  const [{ data: enrollments, error }, { data: club }] = await Promise.all([
    admin
      .from('group_enrollments')
      .select('id, monthly_price, paid_until, start_date, price_per_class_cents, discount_classes_pending')
      .eq('student_id', params.userId)
      .eq('club_id', params.clubId)
      .eq('status', 'active'),
    admin.from('clubs').select('features').eq('id', params.clubId).single(),
  ])
  if (error) throw new Error(error.message)
  return planMandateItems({
    enrollments: (enrollments ?? []) as MandateEnrollment[],
    mode: params.mode,
    currentMonth: madridMonth(),
    classValidation: !!(club as any)?.features?.enable_class_validation,
  })
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
