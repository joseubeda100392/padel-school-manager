import { createClient } from '@/lib/supabase/server'
import { formatDate, formatCurrency } from '@/lib/utils'

const statusBadge: Record<string, string> = {
  succeeded: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-500',
}

const statusLabel: Record<string, string> = {
  succeeded: 'Completado',
  pending: 'Pendiente',
  failed: 'Fallido',
  refunded: 'Reembolsado',
}

const typeLabel: Record<string, string> = {
  subscription: 'Suscripción',
  pay_per_class: 'Clase suelta',
  bag_pack: 'Bolsa de clases',
  manual: 'Manual',
}

export default async function PaymentsPage() {
  const supabase = createClient()

  const { data: payments } = await supabase
    .from('payments')
    .select('*, user:users(name, email)')
    .order('created_at', { ascending: false })
    .limit(200)

  const total = payments?.reduce((acc, p: any) => p.status === 'succeeded' ? acc + p.amount : acc, 0) ?? 0
  const pending = payments?.filter((p: any) => p.status === 'pending').length ?? 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
        <p className="text-sm text-gray-500">{payments?.length ?? 0} transacciones</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
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

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Alumno</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Importe</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!payments?.length && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  No hay pagos aún.
                </td>
              </tr>
            )}
            {payments?.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{p.user?.name ?? '—'}</p>
                  <p className="text-xs text-gray-400">{p.user?.email}</p>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{typeLabel[p.type] ?? p.type}</td>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                  {formatCurrency(p.amount, p.currency ?? 'EUR')}
                </td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {statusLabel[p.status] ?? p.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{formatDate(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
