import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { PayButton } from '@/components/pay-button'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { getClubFeatures } from '@/lib/get-club-features'
import { Minus, Package, Plus } from 'lucide-react'
import { formatLongDate } from '@/lib/format-date'
import { Card, SectionTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { List, ListRow } from '@/components/ui/list'
import { buttonVariants } from '@/components/ui/button'

export default async function StudentBagPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: bagProfile } = await admin.from('users').select('club_id, is_external').eq('id', user.id).single()
  const features = await getClubFeatures((bagProfile as any)?.club_id)
  if (!features.enable_bag) redirect('/student')
  const isExternal = (bagProfile as any)?.is_external === true

  const clubId = (bagProfile as any)?.club_id ?? null

  const [{ data: bag }, { data: transactions }, { data: clubRow }, { count: premiumCoachCount }] = await Promise.all([
    admin
      .from('class_bag')
      .select('balance_60, balance_90, balance_private_60, balance_private_90, balance_private_60_external, balance_private_90_external, balance_private_60_premium, balance_private_90_premium, balance_private_60_premium_external, balance_private_90_premium_external')
      .eq('user_id', user.id)
      .single(),
    admin
      .from('bag_transactions')
      .select('id, delta, type, reason, class_duration, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
    clubId
      ? admin.from('clubs').select('config').eq('id', clubId).single()
      : { data: null },
    clubId
      ? admin.from('users').select('id', { count: 'exact', head: true }).eq('club_id', clubId).eq('role', 'coach').eq('is_premium_private_coach', true)
      : Promise.resolve({ count: 0 }),
  ])

  const balance60 = bag?.balance_60 ?? 0
  const balance90 = bag?.balance_90 ?? 0
  const DEFAULT_CFG = {
    pack_price_60: 9000, classes_per_pack_60: 10, pack_price_90: 12000, classes_per_pack_90: 10,
    pack_price_60_external: 0, classes_per_pack_60_external: 0, pack_price_90_external: 0, classes_per_pack_90_external: 0,
    private_lesson_pack_price_60: 0, private_lesson_pack_classes_60: 0,
    private_lesson_pack_price_90: 0, private_lesson_pack_classes_90: 0,
    private_lesson_pack_price_60_external: 0, private_lesson_pack_classes_60_external: 0,
    private_lesson_pack_price_90_external: 0, private_lesson_pack_classes_90_external: 0,
    private_lesson_pack_price_60_premium: 0, private_lesson_pack_classes_60_premium: 0,
    private_lesson_pack_price_90_premium: 0, private_lesson_pack_classes_90_premium: 0,
    private_lesson_pack_price_60_premium_external: 0, private_lesson_pack_classes_60_premium_external: 0,
    private_lesson_pack_price_90_premium_external: 0, private_lesson_pack_classes_90_premium_external: 0,
  }
  const cfg = { ...DEFAULT_CFG, ...((clubRow as any)?.config ?? {}) }

  // Mismo saldo de siempre (balance_60/90) — un alumno externo solo paga
  // una tarifa distinta por el mismo bono, no lleva un saldo aparte.
  const pack60Price = isExternal ? cfg.pack_price_60_external : cfg.pack_price_60
  const pack60Classes = isExternal ? cfg.classes_per_pack_60_external : cfg.classes_per_pack_60
  const pack90Price = isExternal ? cfg.pack_price_90_external : cfg.pack_price_90
  const pack90Classes = isExternal ? cfg.classes_per_pack_90_external : cfg.classes_per_pack_90

  // Bono de clase particular: sufijo según si el alumno es externo, y si
  // hay al menos un monitor premium en el club (si no, no tiene sentido
  // ofrecer esa tarifa todavía).
  const hasPremiumCoach = (premiumCoachCount ?? 0) > 0
  function privatePackFor(dur: '60' | '90', premium: boolean) {
    const suffix = `${premium ? '_premium' : ''}${isExternal ? '_external' : ''}`
    return {
      price: cfg[`private_lesson_pack_price_${dur}${suffix}` as keyof typeof cfg] as number,
      classes: cfg[`private_lesson_pack_classes_${dur}${suffix}` as keyof typeof cfg] as number,
    }
  }
  const balanceKey = (dur: '60' | '90', premium: boolean) =>
    `balance_private_${dur}${premium ? '_premium' : ''}${isExternal ? '_external' : ''}` as const

  const TZ = 'Europe/Madrid'
  const todaySpain = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const billingStartDate: string | null = (clubRow as any)?.config?.billing_start_date ?? null
  const billingActive = !billingStartDate || todaySpain >= billingStartDate

  const packs = [
    features.enable_60min && pack60Classes > 0 && { key: 'p60', packType: '60' as const, title: 'Bono de 1 h', detail: 'Solo para clases de 1 h', classes: pack60Classes, price: pack60Price },
    features.enable_90min && pack90Classes > 0 && { key: 'p90', packType: '90' as const, title: 'Bono de 1 h 30', detail: 'Vale para clases de 1 h y de 1 h 30', classes: pack90Classes, price: pack90Price },
  ].filter(Boolean) as { key: string; packType: '60' | '90'; title: string; detail: string; classes: number; price: number }[]

  const privatePacks = features.enable_private_lessons
    ? (['60', '90'] as const).flatMap(dur => {
        if (dur === '60' && !features.enable_60min) return []
        if (dur === '90' && !features.enable_90min) return []
        return [false, ...(hasPremiumCoach ? [true] : [])].flatMap(premium => {
          const pack = privatePackFor(dur, premium)
          if (!pack.classes || pack.classes <= 0) return []
          return [{ dur, premium, ...pack }]
        })
      })
    : []

  const durationLabel = (d: string) => (d === '90' ? '1 h 30' : '1 h')

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <RealtimeRefresh
        channelName={`student-bag-${user.id}`}
        subs={[
          { table: 'class_bag', filter: `user_id=eq.${user.id}` },
          { table: 'bag_transactions', filter: `user_id=eq.${user.id}` },
        ]}
      />
      <header>
        <h1 className="font-display text-title text-ink sm:text-display">Bolsa</h1>
        <p className="mt-1 text-body text-ink-2">Tus clases para recuperar faltas o apuntarte a huecos libres.</p>
      </header>

      <Card className={`grid divide-x divide-line ${features.enable_60min && features.enable_90min ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {features.enable_60min && (
          <div className="p-4 sm:p-6">
            <p className="text-meta text-ink-3">Clases de 1 h</p>
            <p className={`mt-1 font-display text-[2.5rem] font-semibold leading-none tabular-nums ${balance60 > 0 ? 'text-ink' : 'text-ink-3/60'}`}>{balance60}</p>
          </div>
        )}
        {features.enable_90min && (
          <div className="p-4 sm:p-6">
            <p className="text-meta text-ink-3">Clases de 1 h 30</p>
            <p className={`mt-1 font-display text-[2.5rem] font-semibold leading-none tabular-nums ${balance90 > 0 ? 'text-ink' : 'text-ink-3/60'}`}>{balance90}</p>
            <p className="mt-2 text-meta text-ink-3">También valen para clases de 1 h</p>
          </div>
        )}
      </Card>

      {features.enable_payments && billingActive && (
        <section className="space-y-4">
          <SectionTitle>Comprar bono{isExternal ? ' (tarifa de alumno externo)' : ''}</SectionTitle>
          {packs.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {packs.map(p => (
                <Card key={p.key} className="flex flex-col p-4 sm:p-5">
                  <p className="text-heading text-ink">{p.title}</p>
                  <p className="mt-0.5 text-meta text-ink-3">{p.detail}</p>
                  <p className="mt-4 flex items-baseline gap-2">
                    <span className="font-display text-title tabular-nums text-ink">{formatCurrency(p.price)}</span>
                    <span className="text-meta text-ink-3">{p.classes} clases · {formatCurrency(Math.round(p.price / p.classes))} cada una</span>
                  </p>
                  <div className="mt-4">
                    <PayButton type="class_pack" packType={p.packType} label={`Comprar por ${formatCurrency(p.price)}`} block className={buttonVariants({ variant: 'secondary', block: true })} cashOnly={features.cash_only_payments} />
                  </div>
                </Card>
              ))}
            </div>
          ) : isExternal ? (
            <p className="text-body text-ink-3">El club todavía no ha configurado el bono para alumnos externos.</p>
          ) : null}
        </section>
      )}

      {features.enable_private_lessons && (
        <section className="space-y-4">
          <SectionTitle>Clases particulares</SectionTitle>
          <Card className="overflow-hidden">
            <List>
              {(['60', '90'] as const).filter(d => (d === '60' ? features.enable_60min : features.enable_90min)).map(dur => (
                <ListRow
                  key={dur}
                  title={`Particulares de ${durationLabel(dur)}`}
                  subtitle={hasPremiumCoach ? `Y ${(bag as any)?.[balanceKey(dur, true)] ?? 0} con monitor premium` : undefined}
                  trailing={<span className="font-display text-title tabular-nums text-ink">{(bag as any)?.[balanceKey(dur, false)] ?? 0}</span>}
                />
              ))}
            </List>
          </Card>
          {features.enable_payments && billingActive && privatePacks.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {privatePacks.map(p => (
                <Card key={`${p.dur}-${p.premium}`} className="flex flex-col p-4 sm:p-5">
                  <p className="text-heading text-ink">Particular de {durationLabel(p.dur)}{p.premium ? ' · monitor premium' : ''}</p>
                  <p className="mt-4 flex items-baseline gap-2">
                    <span className="font-display text-title tabular-nums text-ink">{formatCurrency(p.price)}</span>
                    <span className="text-meta text-ink-3">{p.classes} {p.classes === 1 ? 'clase' : 'clases'}</span>
                  </p>
                  <div className="mt-4">
                    <PayButton
                      type="private_lesson_pack"
                      packType={p.dur}
                      privatePremium={p.premium}
                      label={`Comprar por ${formatCurrency(p.price)}`}
                      variant="secondary"
                      className={buttonVariants({ variant: 'secondary', block: true })}
                      cashOnly={features.cash_only_payments}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        <SectionTitle>Movimientos</SectionTitle>
        {(transactions ?? []).length > 0 ? (
          <Card className="overflow-hidden">
            <List>
              {(transactions ?? []).map(tx => {
                const plus = tx.delta > 0
                return (
                  <ListRow
                    key={tx.id}
                    leading={
                      <span aria-hidden className={`flex h-9 w-9 items-center justify-center rounded-full ${plus ? 'bg-accent-soft text-accent-ink' : 'bg-ink/[0.05] text-ink-3'}`}>
                        {plus ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                      </span>
                    }
                    title={tx.reason}
                    subtitle={`${formatLongDate(tx.created_at, { weekday: false })}${tx.class_duration ? ` · clase de ${durationLabel(tx.class_duration)}` : ''}`}
                    trailing={
                      <span className={`text-[0.9375rem] font-semibold tabular-nums ${plus ? 'text-accent-ink' : 'text-ink-2'}`}>
                        <span className="sr-only">{plus ? 'Entra' : 'Sale'} </span>{plus ? `+${tx.delta}` : `−${Math.abs(tx.delta)}`}
                      </span>
                    }
                  />
                )
              })}
            </List>
          </Card>
        ) : (
          <Card>
            <EmptyState icon={<Package />} title="Aún no hay movimientos" description="Cuando avises de una falta o uses una clase, lo verás aquí." />
          </Card>
        )}
      </section>
    </div>
  )
}
