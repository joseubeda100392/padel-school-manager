import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { formatCurrency } from '@/lib/utils'
import PaymentsTable from './payments-table'

export default async function PaymentsPage() {
  const supabase = createClient()
  const clubId = await getClubId()

  const query = supabase
    .from('payments')
    .select('*, user:users(name, email)')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: payments } = await (clubId ? query.eq('club_id', clubId) : query)

  const total = payments?.reduce((acc, p: any) => p.status === 'succeeded' ? acc + p.amount : acc, 0) ?? 0
  const pending = payments?.filter((p: any) => p.status === 'pending').length ?? 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
        <p className="text-sm text-gray-500">{payments?.length ?? 0} transacciones</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total cobrado</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(total)}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Transacciones</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{payments?.length ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pendientes</p>
          <p className={`mt-1 text-2xl font-bold ${pending > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>{pending}</p>
        </div>
      </div>

      <PaymentsTable payments={payments ?? []} />
    </div>
  )
}
