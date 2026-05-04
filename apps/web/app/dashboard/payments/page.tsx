import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { formatCurrency } from '@/lib/utils'
import PaymentsTable from './payments-table'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
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
        {unpaid.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-green-600 font-medium">✓ Todos los alumnos han pagado este mes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Alumno</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Clase</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Importe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Último pago</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {unpaid.map((e: any) => {
                  const dow = e.start_time ? new Date(e.start_time).getDay() : null
                  const time = e.start_time
                    ? new Date(e.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    : null
                  return (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{e.student_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{e.student_email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {dow !== null ? `${DAYS[dow]} ${time}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-yellow-600">
                        {formatCurrency(e.monthly_price)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {e.paid_until
                          ? new Date(e.paid_until).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Nunca'}
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={`/dashboard/schedule/${e.schedule_id}`}
                          className="text-xs font-medium text-green-600 hover:underline"
                        >
                          Marcar pagado →
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historial de transacciones */}
      <div>
        <h2 className="mb-4 font-semibold text-gray-900">Historial de transacciones</h2>
        <PaymentsTable payments={payments ?? []} />
      </div>
    </div>
  )
}
