import type { SupabaseClient } from '@supabase/supabase-js'

// Mensualidades de grupo sin cobrar de un mes (Pagos del admin y Caja del
// cobrador). Antes de billing_start_date del club no hay seguimiento.
export async function loadPendingFees(
  admin: SupabaseClient,
  clubId: string | null,
  year: number,
  month0: number,
  billingStartDate: string | null,
  todaySpain: string,
): Promise<{ items: any[]; error: { message: string } | null; billingActive: boolean }> {
  const billingActive = !billingStartDate || todaySpain >= billingStartDate
  if (!billingActive) return { items: [], error: null, billingActive }

  const { data, error } = await admin.rpc('get_pending_payments', {
    p_club_id: clubId ?? null,
    p_year: year,
    p_month: month0 + 1,
  })
  const raw: any[] = (data as any[]) ?? []

  // Para cobrar hace falta saber desde cuándo paga (primer mes sin paid_until).
  const { data: starts } = raw.length
    ? await admin.from('group_enrollments').select('id, start_date').in('id', raw.map((u) => u.id))
    : { data: [] as { id: string; start_date: string | null }[] }
  const startById = new Map((starts ?? []).map((e) => [e.id, e.start_date]))

  const billingStart = billingStartDate ? new Date(billingStartDate + 'T00:00:00') : null
  const monthsSinceBilling = billingStart
    ? (year - billingStart.getFullYear()) * 12 + (month0 - billingStart.getMonth()) + 1
    : null
  const items = raw.map((item) => ({
    ...item,
    months_overdue: monthsSinceBilling === null ? item.months_overdue : Math.min(item.months_overdue, monthsSinceBilling),
    start_date: startById.get(item.id) ?? null,
  }))
  return { items, error: error ?? null, billingActive }
}
