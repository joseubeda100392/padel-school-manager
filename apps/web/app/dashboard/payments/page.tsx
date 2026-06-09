import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { formatCurrency } from '@/lib/utils'
import PaymentsTable from './payments-table'
import { UnpaidList } from './unpaid-list'
import { MonthNavigator } from './month-navigator'
import { DevError } from '@/components/dev-error'
import { RealtimeRefresh } from '@/components/realtime-refresh'

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default async function PaymentsPage({ searchParams }: { searchParams: { month?: string } }) {
  const admin = getAdminClient()
  const clubId = await getClubId()

  const now = new Date()
  const parsedDate = searchParams.month ? new Date(searchParams.month + '-01') : null
  const selectedDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : now
  const selectedYear = selectedDate.getFullYear()
  const selectedMonth = selectedDate.getMonth()
  const monthLabel = `${MONTHS[selectedMonth]} ${selectedYear}`

  const startOfMonth = new Date(selectedYear, selectedMonth, 1).toISOString()
  const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999).toISOString()

  const baseQuery = admin
    .from('payments')
    .select('*, user:users(name, email)')
    .gte('created_at', startOfMonth)
    .lte('created_at', endOfMonth)
    .order('created_at', { ascending: false })
    .limit(200)

  const [{ data: payments, error: errPayments }, { data: unpaidList, error: errUnpaid }] = await Promise.all([
    clubId ? baseQuery.eq('club_id', clubId) : baseQuery,
    admin.rpc('get_pending_payments', {
      p_club_id: clubId ?? null,
      p_year: selectedYear,
      p_month: selectedMonth + 1, // RPC expects 1-indexed month
    }),
  ])

  const total = payments?.reduce((acc, p: any) => p.status === 'succeeded' ? acc + p.amount : acc, 0) ?? 0
  const unpaid = unpaidList ?? []

  return (
    <div className="space-y-6">
      <DevError errors={[errPayments?.message, errUnpaid?.message]} />
      <RealtimeRefresh
        channelName="admin-payments"
        subs={[
          { table: 'payments' },
          { table: 'group_enrollments' },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
          <p className="text-sm text-gray-500">{payments?.length ?? 0} transacciones en {monthLabel}</p>
        </div>
        <MonthNavigator year={selectedYear} month={selectedMonth} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border-l-4 border-l-green-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total cobrado en {monthLabel}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(total)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-l-blue-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Transacciones</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{payments?.length ?? 0}</p>
        </div>
        <div className="rounded-xl border-l-4 border-l-yellow-500 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pendientes de pago</p>
          <p className={`mt-2 text-2xl font-bold ${unpaid.length > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
            {unpaid.length}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Mensualidades pendientes — {monthLabel}</h2>
          <p className="text-xs text-gray-400">{unpaid.length} alumnos sin regularizar</p>
        </div>
        <UnpaidList items={unpaid as any[]} monthLabel={monthLabel} />
      </div>

      <div>
        <h2 className="mb-4 font-semibold text-gray-900">Transacciones — {monthLabel}</h2>
        <PaymentsTable payments={payments ?? []} />
      </div>
    </div>
  )
}
