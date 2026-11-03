import type { SupabaseClient } from '@supabase/supabase-js'
import { monthsLabel } from '@/lib/payment-concept'

// Cuota mensual que el club paga a ePadel School por transferencia. Cada mes se
// debe desde el día 1 y vence el día APP_FEE_DUE_DAY.
export const APP_FEE_DUE_DAY = 5

export interface AppFeePlan { start_month: string; amount: number; first_due_date?: string | null }
export interface AppFeeRecord { month: string; notified_at: string | null; paid_at: string | null }

export interface AppFeeStatus {
  months: string[]
  label: string
  amount: number
  total: number
  dueDate: string
  overdue: boolean
  notified: boolean
}

export interface AppFeeBank { holder: string; iban: string }

const MADRID_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })

export function madridToday(now: Date = new Date()): string {
  return MADRID_DATE.format(now)
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

export function appFeeStatus(plan: AppFeePlan, records: AppFeeRecord[], today: string): AppFeeStatus | null {
  const months = pendingAppFeeMonths(plan, records, today)
  if (!months.length) return null
  const notifiedMonths = new Set(records.filter(r => r.notified_at && !r.paid_at).map(r => r.month.slice(0, 7)))
  const amount = Number(plan.amount)
  const dueDate = dueDateOf(months[0], plan)
  return {
    months,
    label: monthsLabel(months),
    amount,
    total: Math.round(amount * months.length * 100) / 100,
    dueDate,
    overdue: today > dueDate,
    notified: months.every(m => notifiedMonths.has(m)),
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
    admin.from('app_fee_plans').select('start_month, amount, first_due_date').eq('club_id', clubId).maybeSingle(),
    admin.from('app_fee_payments').select('month, notified_at, paid_at').eq('club_id', clubId),
  ])
  if (planError || recordsError) {
    console.error('[app-fee] no se pudo leer la cuota del club', clubId, planError ?? recordsError)
    return { plan: null, records: [] as AppFeeRecord[] }
  }
  return { plan: plan as AppFeePlan | null, records: (records ?? []) as AppFeeRecord[] }
}
