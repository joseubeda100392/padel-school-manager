import type { getAdminClient } from '@/lib/supabase/admin'
import { lastDayOfMonthStr } from '@/lib/billing-cycle'

type Admin = ReturnType<typeof getAdminClient>

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
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

export function isPaidPayment(p: { status?: string | null }) {
  return p.status === 'completed' || p.status === 'succeeded'
}

// Cobros de un mes, con el mismo criterio que la pantalla de Pagos: la cuota
// mensual cuenta en el mes que CUBRE (metadata.paid_until), no en el que se
// pagó, para que un adelanto no infle un mes y vacíe el siguiente. Los pagos
// antiguos sin ese campo, y el resto de tipos, cuentan por fecha de pago.
export async function loadMonthPayments(admin: Admin, clubId: string | null, year: number, month0: number) {
  const startOfMonth = new Date(year, month0, 1).toISOString()
  const endOfMonth = new Date(year, month0 + 1, 0, 23, 59, 59, 999).toISOString()
  const targetPaidUntil = lastDayOfMonthStr(year, month0)

  function withClub<T extends { eq: (col: string, val: string) => T }>(query: T): T {
    return clubId ? query.eq('club_id', clubId) : query
  }

  const [byCoverage, legacy, others] = await Promise.all([
    withClub(admin.from('payments').select('*, user:users(name, email)', { count: 'exact' })
      .eq('type', 'fixed_group_month')
      .eq('metadata->>paid_until', targetPaidUntil)),
    withClub(admin.from('payments').select('*, user:users(name, email)', { count: 'exact' })
      .eq('type', 'fixed_group_month')
      .is('metadata->paid_until', null)
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth)),
    withClub(admin.from('payments').select('*, user:users(name, email)', { count: 'exact' })
      .neq('type', 'fixed_group_month')
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth)),
  ])

  return {
    payments: [...(byCoverage.data ?? []), ...(legacy.data ?? []), ...(others.data ?? [])] as any[],
    count: (byCoverage.count ?? 0) + (legacy.count ?? 0) + (others.count ?? 0),
    error: byCoverage.error ?? legacy.error ?? others.error ?? null,
  }
}
