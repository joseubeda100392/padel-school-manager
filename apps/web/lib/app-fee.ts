import type { SupabaseClient } from '@supabase/supabase-js'
import { monthsLabel } from '@/lib/payment-concept'

// Cuota mensual que el club paga a ePadel School por transferencia. Cada mes se
// debe desde el día 1 y vence el día APP_FEE_DUE_DAY. Si no avisa de la
// transferencia, a los 6 días del vencimiento (el 11) le sale una ventana al
// entrar y a los 11 (el 16) el panel queda en solo lectura, si el club lo tiene
// activado.
export const APP_FEE_DUE_DAY = 5
export const APP_FEE_REMINDER_AFTER_DAYS = 6
export const APP_FEE_LOCK_AFTER_DAYS = 11
// «Ya he hecho la transferencia» frena la ventana y el bloqueo solo estos días:
// si no llega el dinero (no lo marcamos pagado), vuelven.
export const APP_FEE_NOTICE_VALID_DAYS = 5

export interface AppFeePlan { start_month: string; amount: number; first_due_date?: string | null; lock_when_overdue?: boolean }
export interface AppFeeRecord { month: string; notified_at: string | null; paid_at: string | null }

export interface AppFeeStatus {
  months: string[]
  label: string
  amount: number
  total: number
  dueDate: string
  overdue: boolean
  notified: boolean
  reminder: boolean
  locked: boolean
  lockDate: string | null
}

export interface AppFeeBank { holder: string; iban: string }

const MADRID_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })

export function madridToday(now: Date = new Date()): string {
  return MADRID_DATE.format(now)
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

// Fecha límite de un mes: el día 5, salvo que el plan dé un primer plazo posterior.
export function dueDateOf(ym: string, plan?: AppFeePlan): string {
  const due = `${ym}-${String(APP_FEE_DUE_DAY).padStart(2, '0')}`
  const first = plan?.first_due_date?.slice(0, 10)
  return first && first > due ? first : due
}

// Meses ('YYYY-MM') desde el de inicio hasta el actual que no están pagados.
export function pendingAppFeeMonths(plan: AppFeePlan, records: AppFeeRecord[], today: string): string[] {
  const paid = new Set(records.filter(r => r.paid_at).map(r => r.month.slice(0, 7)))
  const current = today.slice(0, 7)
  const months: string[] = []
  for (let m = plan.start_month.slice(0, 7); m <= current; m = nextMonth(m)) {
    if (!paid.has(m)) months.push(m)
  }
  return months
}

// Meses con un aviso de transferencia todavía vigente.
export function recentlyNotifiedMonths(records: AppFeeRecord[], today: string): Set<string> {
  const since = addDays(today, -APP_FEE_NOTICE_VALID_DAYS)
  return new Set(records.filter(r => r.notified_at && !r.paid_at && madridToday(new Date(r.notified_at)) >= since).map(r => r.month.slice(0, 7)))
}

export function appFeeStatus(plan: AppFeePlan, records: AppFeeRecord[], today: string): AppFeeStatus | null {
  const months = pendingAppFeeMonths(plan, records, today)
  if (!months.length) return null
  const notifiedMonths = recentlyNotifiedMonths(records, today)
  const amount = Number(plan.amount)
  const dueDate = dueDateOf(months[0], plan)
  const notified = months.every(m => notifiedMonths.has(m))
  return {
    months,
    label: monthsLabel(months),
    amount,
    total: Math.round(amount * months.length * 100) / 100,
    dueDate,
    overdue: today > dueDate,
    notified,
    reminder: !notified && today >= addDays(dueDate, APP_FEE_REMINDER_AFTER_DAYS),
    locked: !notified && !!plan.lock_when_overdue && today >= addDays(dueDate, APP_FEE_LOCK_AFTER_DAYS),
    lockDate: plan.lock_when_overdue ? addDays(dueDate, APP_FEE_LOCK_AFTER_DAYS) : null,
  }
}

// Datos de la cuenta, en variables de entorno de Railway (no en git).
export function appFeeBank(): AppFeeBank | null {
  const holder = process.env.APP_FEE_HOLDER?.trim()
  const iban = process.env.APP_FEE_IBAN?.trim()
  return holder && iban ? { holder, iban } : null
}

export async function loadAppFee(admin: SupabaseClient, clubId: string) {
  const [{ data: plan, error: planError }, { data: records, error: recordsError }] = await Promise.all([
    admin.from('app_fee_plans').select('start_month, amount, first_due_date, lock_when_overdue').eq('club_id', clubId).maybeSingle(),
    admin.from('app_fee_payments').select('month, notified_at, paid_at').eq('club_id', clubId),
  ])
  if (planError || recordsError) {
    console.error('[app-fee] no se pudo leer la cuota del club', clubId, planError ?? recordsError)
    return { plan: null, records: [] as AppFeeRecord[] }
  }
  return { plan: plan as AppFeePlan | null, records: (records ?? []) as AppFeeRecord[] }
}
