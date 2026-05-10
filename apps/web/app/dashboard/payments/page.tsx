import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { formatCurrency } from '@/lib/utils'
import PaymentsTable from './payments-table'
import { UnpaidList } from './unpaid-list'

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default async function PaymentsPage() {
  const supabase = createClient()
  const clubId = await getClubId()

  const now = new Date()
  const currentMonthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  const paymentsQuery = supabase
    .from('payments')
    .select('*, user:users(name, email)')
    .order('created_at', { ascending: false })
    .limit(200)

  const [{ data: payments }, { data: unpaidList }] = await Promise.all([
    clubId ? paymentsQuery.eq('club_id', clubId) : paymentsQuery,
    supabase.rpc('get_pending_payments', { p_club_id: clubId ?? null }),
  ])

  const total = payments?.reduce((acc, p: any) => p.status === 'succeeded' ? acc + p.amount : acc, 0) ?? 0
  const unpaid = unpaidList ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
        <p className="text-sm text-gray-500">{payments?.length ?? 0} transacciones registradas</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border-l-4 border-l-green-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total cobrado</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(total)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-l-blue-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Transacciones</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{payments?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border-l-4 border-l-yellow-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Sin pagar este mes</p>
          <p className={`mt-2 text-2xl font-bold ${unpaid.length > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
            {unpaid.length}
          </p>
        </div>
      </div>

      {/* Mensualidades pendientes */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Mensualidades pendientes — {currentMonthLabel}</h2>
          <p className="text-xs text-gray-400">{unpaid.length} alumnos sin pagar</p>
        </div>
        <UnpaidList items={unpaid as any[]} monthLabel={currentMonthLabel} />
      </div>

      {/* Historial de transacciones */}
      <div>
        <h2 className="mb-4 font-semibold text-gray-900">Historial de transacciones</h2>
        <PaymentsTable payments={payments ?? []} />
      </div>
    </div>
  )
}
