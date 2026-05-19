import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { PayButton } from '@/components/pay-button'
import { RealtimeRefresh } from '@/components/realtime-refresh'

export default async function StudentBagPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  // Get user's club_id
  const { data: userProfile } = await admin
    .from('users')
    .select('club_id')
    .eq('id', user.id)
    .single()
  const clubId = userProfile?.club_id ?? null

  const [{ data: bag }, { data: transactions }, { data: packs }] = await Promise.all([
    admin.from('class_bag').select('balance_60, balance_90').eq('user_id', user.id).single(),
    admin
      .from('bag_transactions')
      .select('id, delta, type, reason, class_duration, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
    clubId
      ? admin
          .from('club_packs')
          .select('id, name, duration_type, classes, price')
          .eq('club_id', clubId)
          .eq('is_enabled', true)
          .order('sort_order')
          .order('created_at')
      : Promise.resolve({ data: [] }),
  ])

  const balance60 = bag?.balance_60 ?? 0
  const balance90 = bag?.balance_90 ?? 0
  const activePacks = packs ?? []

  return (
    <div className="space-y-8 pb-10" style={{ fontFamily: 'Inter, sans-serif' }}>
      <RealtimeRefresh
        channelName={`student-bag-${user.id}`}
        subs={[
          { table: 'class_bag', filter: `user_id=eq.${user.id}` },
          { table: 'bag_transactions', filter: `user_id=eq.${user.id}` },
        ]}
      />

      {/* Header + Saldo */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] sm:text-[28px] md:text-[32px] font-bold tracking-tight leading-tight" style={{ color: '#0b1c30' }}>
              Tienda de Sesiones
            </h1>
            <p className="mt-1 text-[13px] sm:text-[14px] leading-relaxed" style={{ color: '#3e4a3d' }}>
              Gestiona tus créditos y elige el pack que mejor se adapte a tu ritmo de entrenamiento.
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-4 rounded-xl border p-4 sm:p-5 shadow-sm w-full sm:w-auto sm:self-start"
          style={{ background: '#d3e4fe', borderColor: '#bdcaba' }}
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
            style={{ background: '#00873a' }}
          >
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: '#3e4a3d' }}>Saldo Actual</p>
            <p className="text-[24px] font-extrabold leading-tight" style={{ color: '#006b2c' }}>
              {String(balance60 + balance90).padStart(2, '0')} Clases
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: '#3e4a3d' }}>
              60 min: <strong>{balance60}</strong> · 90 min: <strong>{balance90}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Saldos detalle */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          className="rounded-xl border p-4 sm:p-5 shadow-sm"
          style={{ background: '#ffffff', borderColor: '#bdcaba', borderTopColor: '#006b2c', borderTopWidth: 4 }}
        >
          <p className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: '#3e4a3d' }}>Clases 1h disponibles</p>
          <p className="mt-2 text-[34px] sm:text-[42px] font-extrabold leading-none" style={{ color: balance60 > 0 ? '#006b2c' : '#bdcaba' }}>{balance60}</p>
          <p className="mt-1.5 text-[12px]" style={{ color: '#6e7b6c' }}>Bono 60 min · válido para clases de 1 hora</p>
        </div>
        <div
          className="rounded-xl border p-4 sm:p-5 shadow-sm"
          style={{ background: '#ffffff', borderColor: '#bdcaba', borderTopColor: '#006a61', borderTopWidth: 4 }}
        >
          <p className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: '#3e4a3d' }}>Clases 1h 30min disponibles</p>
          <p className="mt-2 text-[34px] sm:text-[42px] font-extrabold leading-none" style={{ color: balance90 > 0 ? '#006a61' : '#bdcaba' }}>{balance90}</p>
          <p className="mt-1.5 text-[12px]" style={{ color: '#6e7b6c' }}>Bono 90 min · vale para 1h y 1h 30min</p>
        </div>
      </div>

      {/* Comprar bonos */}
      {activePacks.length > 0 && (
        <div>
          <h2 className="mb-5 text-[18px] font-semibold" style={{ color: '#0b1c30' }}>Comprar bono</h2>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2">
            {activePacks.map((pack, i) => {
              const is90 = pack.duration_type === '90'
              const isPopular = i === 0
              const pricePerClass = pack.classes > 0 ? Math.round(pack.price / pack.classes) : 0
              const accentColor = is90 ? '#006a61' : '#006b2c'
              const badgeLabel = isPopular ? 'Recomendado' : (is90 ? 'Pro' : 'Básico')
              const badgeBg = isPopular ? '#00873a' : (is90 ? '#86f2e4' : '#e5eeff')
              const badgeText = isPopular ? '#f7fff2' : (is90 ? '#006f66' : '#006b2c')
              const savings = pack.classes > 1 ? Math.round((pricePerClass * pack.classes * 0.15)) : 0

              return (
                <div
                  key={pack.id}
                  className="rounded-xl flex flex-col relative overflow-hidden transition-all duration-200 hover:-translate-y-1"
                  style={{
                    background: '#ffffff',
                    border: isPopular ? `2px solid #006b2c` : `1px solid #bdcaba`,
                    boxShadow: isPopular ? '0 8px 24px rgba(0,107,44,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
                    padding: '20px',
                  }}
                >
                  {/* Popular ribbon */}
                  {isPopular && (
                    <div
                      className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                      style={{ background: '#006b2c', color: '#ffffff' }}
                    >
                      POPULAR
                    </div>
                  )}

                  {/* Badge */}
                  <div className="flex justify-between items-start mb-4">
                    <span
                      className="text-[12px] font-semibold px-3 py-1 rounded-full"
                      style={{ background: badgeBg, color: badgeText }}
                    >
                      {badgeLabel}
                    </span>
                  </div>

                  <h3 className="text-[20px] font-semibold mb-1" style={{ color: '#0b1c30' }}>{pack.name}</h3>
                  <p className="text-[14px] mb-5 flex-grow" style={{ color: '#3e4a3d' }}>
                    {pack.classes} sesiones de {is90 ? '1h 30min' : '1 hora'}
                  </p>

                  <div className="mb-4 sm:mb-5">
                    <span className="text-[26px] sm:text-[32px] font-bold" style={{ color: '#0b1c30' }}>{formatCurrency(pack.price)}</span>
                    <span className="text-[14px] ml-1" style={{ color: '#6e7b6c' }}>/ pack</span>
                    {savings > 0 && (
                      <div className="text-[12px] font-semibold mt-1" style={{ color: accentColor }}>
                        {formatCurrency(pricePerClass)} / clase
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-[14px]" style={{ color: '#0b1c30' }}>
                      <CheckIcon color={accentColor} />
                      {pack.classes} sesiones de {is90 ? '1h 30min' : '1 hora'}
                    </li>
                    <li className="flex items-center gap-2 text-[14px]" style={{ color: '#0b1c30' }}>
                      <CheckIcon color={accentColor} />
                      Reserva prioritaria
                    </li>
                    {isPopular && (
                      <li className="flex items-center gap-2 text-[14px]" style={{ color: '#0b1c30' }}>
                        <CheckIcon color={accentColor} />
                        Válido por 3 meses
                      </li>
                    )}
                  </ul>

                  <PayButton
                    type="class_pack"
                    packId={pack.id}
                    label="Comprar Pack"
                    className={
                      isPopular
                        ? `w-full rounded-lg px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50 transition-colors active:scale-95 ${is90 ? 'bg-[#006a61] hover:bg-[#005550]' : 'bg-[#006b2c] hover:bg-[#005523]'}`
                        : 'w-full rounded-lg px-4 py-3 text-[14px] font-semibold text-[#0b1c30] border border-[#6e7b6c] bg-transparent hover:bg-[#f8f9ff] disabled:opacity-50 transition-colors active:scale-95'
                    }
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Historial */}
      {(transactions ?? []).length > 0 && (
        <div>
          <h2 className="mb-5 text-[18px] font-semibold" style={{ color: '#0b1c30' }}>Historial de movimientos</h2>
          <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: '#bdcaba' }}>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y" style={{ borderColor: '#e5eeff' }}>
              <thead style={{ background: '#eff4ff' }}>
                <tr className="text-left">
                  <th className="px-3 sm:px-4 py-3 text-[12px] font-semibold uppercase tracking-widest" style={{ color: '#3e4a3d' }}>Fecha</th>
                  <th className="px-3 sm:px-4 py-3 text-[12px] font-semibold uppercase tracking-widest" style={{ color: '#3e4a3d' }}>Concepto</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-[12px] font-semibold uppercase tracking-widest" style={{ color: '#3e4a3d' }}>Duración</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-widest" style={{ color: '#3e4a3d' }}>Clases</th>
                </tr>
              </thead>
              <tbody>
                {(transactions ?? []).map(tx => (
                  <tr
                    key={tx.id}
                    className="transition-colors hover:bg-[#f8f9ff]"
                    style={{ borderTop: '1px solid #e5eeff' }}
                  >
                    <td className="whitespace-nowrap px-3 sm:px-4 py-3 text-[12px] sm:text-[13px]" style={{ color: '#6e7b6c' }}>
                      {new Date(tx.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-[13px] sm:text-[14px] font-medium" style={{ color: '#0b1c30' }}>{tx.reason}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-[13px]" style={{ color: '#6e7b6c' }}>
                      {tx.class_duration ? `${tx.class_duration} min` : '—'}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 sm:px-4 py-3 text-right text-[13px] sm:text-[14px] font-bold"
                      style={{ color: tx.delta > 0 ? '#006b2c' : '#ba1a1a' }}
                    >
                      {tx.delta > 0 ? `+${tx.delta}` : tx.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
