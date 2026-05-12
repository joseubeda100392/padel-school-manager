import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { PayButton } from '@/components/pay-button'
import { RealtimeRefresh } from '@/components/realtime-refresh'

export default async function StudentBagPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: bag }, { data: transactions }, { data: configs }] = await Promise.all([
    supabase.from('class_bag').select('balance').eq('user_id', user.id).single(),
    supabase
      .from('bag_transactions')
      .select('id, delta, type, reason, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['pack_price_60', 'classes_per_pack_60', 'pack_price_90', 'classes_per_pack_90']),
  ])

  const balance = bag?.balance ?? 0
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

      {/* Balance card */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase text-gray-500">Clases disponibles</p>
        <p className={`mt-2 text-6xl font-bold ${balance > 0 ? 'text-green-600' : 'text-gray-300'}`}>
          {balance}
        </p>
        {balance === 0 && (
          <p className="mt-2 text-sm text-gray-400">
            Compra un bono para apuntarte a huecos libres.
          </p>
        )}
      </div>

      {/* Comprar bono */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Comprar bono</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-lg font-bold text-gray-900">Bono 1 hora</p>
            <p className="mt-1 text-sm text-gray-500">{pack60Classes} clases · clases de 60 min</p>
            <p className="mt-3 text-2xl font-bold text-green-600">{formatCurrency(pack60Price)}</p>
            <PayButton
              type="class_pack"
              packType="60"
              label="💳 Comprar bono"
              className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            />
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-lg font-bold text-gray-900">Bono 1h 30min</p>
            <p className="mt-1 text-sm text-gray-500">{pack90Classes} clases · clases de 90 min</p>
            <p className="mt-3 text-2xl font-bold text-green-600">{formatCurrency(pack90Price)}</p>
            <PayButton
              type="class_pack"
              packType="90"
              label="💳 Comprar bono"
              className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            />
          </div>
        </div>
      </div>

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
                    <td className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold ${tx.delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
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
