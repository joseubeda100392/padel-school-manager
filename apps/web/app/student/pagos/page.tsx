import { getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Receipt } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatLongDate } from '@/lib/format-date'
import { DEFAULT_FEATURES, parseClubFeatures } from '@/lib/get-club-features'
import { paymentConcept } from '@/lib/payment-concept'
import { PAYMENT_METHODS, paymentMethodKey } from '@/lib/payment-method'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { List, ListRow } from '@/components/ui/list'
import { Badge } from '@/components/ui/badge'
import { isVoidedPayment } from '@/lib/payment-void'

// Lo que el alumno ha pagado: cuotas con el mes que cubren, bonos, clases
// sueltas, cargos. Solo pagos hechos o devueltos; los intentos de pago con
// tarjeta que no terminaron no le interesan.
export default async function StudentPaymentsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const [{ data: profile }, { data: payments }] = await Promise.all([
    admin.from('users').select('club_id, club:clubs(features)').eq('id', user.id).single(),
    admin
      .from('payments')
      .select('id, amount, currency, type, status, created_at, metadata, redsys_order_id, stripe_payment_intent_id')
      .eq('user_id', user.id)
      .in('status', ['succeeded', 'refunded'])
      .order('created_at', { ascending: false })
      .limit(100),
  ])
  const features = (profile as any)?.club_id ? parseClubFeatures((profile as any)?.club?.features) : DEFAULT_FEATURES
  if (!features.enable_payments) redirect('/student')
  // Un cobro que el club anuló (apuntado por error) no llegó a pagarse.
  const visible = (payments ?? []).filter((p: any) => !isVoidedPayment(p))

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header>
        <h1 className="font-display text-title text-ink sm:text-display">Mis pagos</h1>
        <p className="mt-1 text-body text-ink-2">Lo que has pagado al club y qué mes cubre cada cuota.</p>
      </header>

      {visible.length > 0 ? (
        <Card className="overflow-hidden">
          <List>
            {visible.map((p: any) => {
              const concept = paymentConcept(p)
              const method = PAYMENT_METHODS[paymentMethodKey(p)].label
              const refunded = p.status === 'refunded'
              return (
                <ListRow
                  key={p.id}
                  leading={
                    <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                      <Receipt className="h-4 w-4" />
                    </span>
                  }
                  title={concept.title}
                  subtitle={[
                    concept.detail,
                    `Pagado el ${formatLongDate(p.created_at, { weekday: false })}`,
                    method !== '—' ? method : null,
                  ].filter(Boolean).join(' · ')}
                  trailing={
                    <span className="flex flex-col items-end gap-1">
                      <span className={`text-[0.9375rem] font-semibold tabular-nums ${refunded ? 'text-ink-3 line-through' : 'text-ink'}`}>
                        {formatCurrency(p.amount, p.currency ?? 'EUR')}
                      </span>
                      {refunded && <Badge tone="neutral">Devuelto</Badge>}
                    </span>
                  }
                />
              )
            })}
          </List>
        </Card>
      ) : (
        <Card>
          <EmptyState icon={<Receipt />} title="Aún no hay pagos" description="Cuando pagues una cuota, un bono o una clase, lo verás aquí." />
        </Card>
      )}
    </div>
  )
}
