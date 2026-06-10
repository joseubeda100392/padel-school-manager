import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { PayButton } from '@/components/pay-button'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { getClubFeatures } from '@/lib/get-club-features'

export default async function StudentBagPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: bagProfile } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const features = await getClubFeatures((bagProfile as any)?.club_id)
  if (!features.enable_bag) redirect('/student')

  const [{ data: bag }, { data: transactions }, { data: configs }] = await Promise.all([
    admin.from('class_bag').select('balance_60, balance_90').eq('user_id', user.id).single(),
    admin
      .from('bag_transactions')
      .select('id, delta, type, reason, class_duration, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
    admin
      .from('app_config')
      .select('key, value')
      .in('key', ['pack_price_60', 'classes_per_pack_60', 'pack_price_90', 'classes_per_pack_90']),
  ])

  const balance60 = bag?.balance_60 ?? 0
  const balance90 = bag?.balance_90 ?? 0
  const cfg = Object.fromEntries((configs ?? []).map(c => [c.key, c.value]))

  const pack60Price = parseInt(cfg.pack_price_60 ?? '9000')
  const pack60Classes = parseInt(cfg.classes_per_pack_60 ?? '10')
  const pack90Price = parseInt(cfg.pack_price_90 ?? '12000')
  const pack90Classes = parseInt(cfg.classes_per_pack_90 ?? '10')

  return (
    <div className="max-w-2xl">
      <RealtimeRefresh
        channelName={`student-bag-${user.id}`}
        subs={[
          { table: 'class_bag', filter: `user_id=eq.${user.id}` },
          { table: 'bag_transactions', filter: `user_id=eq.${user.id}` },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi Bolsa</h1>
        <p className="text-sm text-gray-500">Clases disponibles para huecos libres</p>
      </div>

      {/* Saldos */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {features.enable_60min && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase text-gray-500">Clases 1h disponibles</p>
            <p className={`mt-2 text-5xl font-bold ${balance60 > 0 ? 'text-brand-500' : 'text-gray-300'}`}>
              {balance60}
            </p>
            <p className="mt-1 text-xs text-gray-400">Bono 60 min · válido para clases de 1h</p>
          </div>
        )}
        {features.enable_90min && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase text-gray-500">Clases 1h 30min disponibles</p>
            <p className={`mt-2 text-5xl font-bold ${balance90 > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
              {balance90}
            </p>
            <p className="mt-1 text-xs text-gray-400">Bono 90 min · válido para 1h y 1h 30min</p>
          </div>
        )}
      </div>

      {/* Comprar bono */}
      {features.enable_payments && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Comprar bono</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.enable_60min && (
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-lg font-bold text-gray-900">Bono 1 hora</p>
                <p className="mt-1 text-sm text-gray-500">{pack60Classes} clases · solo clases de 60 min</p>
                <p className="mt-3 text-2xl font-bold text-brand-500">{formatCurrency(pack60Price)}</p>
                <PayButton
                  type="class_pack"
                  packType="60"
                  label="💳 Comprar bono"
                  className="mt-4 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                />
              </div>
            )}
            {features.enable_90min && (
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-lg font-bold text-gray-900">Bono 1h 30min</p>
                <p className="mt-1 text-sm text-gray-500">{pack90Classes} clases · vale para 1h y 1h 30min</p>
                <p className="mt-3 text-2xl font-bold text-blue-600">{formatCurrency(pack90Price)}</p>
                <PayButton
                  type="class_pack"
                  packType="90"
                  label="💳 Comprar bono"
                  className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historial */}
      {(transactions ?? []).length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Historial</h2>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="text-left text-xs font-medium uppercase text-gray-400">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Clases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(transactions ?? []).map(tx => (
                  <tr key={tx.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {new Date(tx.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{tx.reason}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {tx.class_duration ? `${tx.class_duration} min` : '—'}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold ${tx.delta > 0 ? 'text-brand-500' : 'text-red-500'}`}>
                      {tx.delta > 0 ? `+${tx.delta}` : tx.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
