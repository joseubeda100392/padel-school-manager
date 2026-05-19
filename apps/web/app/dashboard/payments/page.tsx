import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { formatCurrency } from '@/lib/utils'
import PaymentsTable from './payments-table'
import { UnpaidList } from './unpaid-list'
import { MonthNavigator } from './month-navigator'
import { DevError } from '@/components/dev-error'

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <nav className="mb-1 flex items-center gap-1 text-[12px] text-gray-400">
            <span>Dashboard</span><span className="mx-1">/</span>
            <span className="font-semibold text-[#006b2c]">Pagos</span>
          </nav>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Gestión de Pagos</h1>
          <p className="mt-0.5 text-[13px] text-gray-400">{payments?.length ?? 0} transacciones — <span className="font-semibold text-gray-600">{monthLabel}</span></p>
        </div>
        <MonthNavigator year={selectedYear} month={selectedMonth} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm border-t-4 border-t-[#006b2c] hover:-translate-y-1 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total cobrado</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{formatCurrency(total)}</p>
          <p className="mt-1 text-[12px] text-gray-400">{monthLabel}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm border-t-4 border-t-blue-500 hover:-translate-y-1 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Transacciones</p>
          <p className="mt-2 text-3xl font-extrabold text-gray-900">{payments?.length ?? 0}</p>
          <p className="mt-1 text-[12px] text-gray-400">{monthLabel}</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm border-t-4 border-t-amber-500 hover:-translate-y-1 hover:shadow-md transition-all duration-200">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Pendientes</p>
          <p className={`mt-2 text-3xl font-extrabold ${unpaid.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{unpaid.length}</p>
          <p className="mt-1 text-[12px] text-gray-400">alumnos sin pagar</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/60 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Mensualidades pendientes — {monthLabel}</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">{unpaid.length} alumnos sin regularizar</p>
          </div>
        </div>
        <UnpaidList items={unpaid as any[]} monthLabel={monthLabel} />
      </div>

      <div>
        <h2 className="mb-4 text-[15px] font-bold text-gray-900">Transacciones — {monthLabel}</h2>
        <PaymentsTable payments={payments ?? []} />
      </div>
    </div>
  )
}
