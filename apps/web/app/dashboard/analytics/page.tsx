import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { formatCurrency } from '@/lib/utils'

export default async function AnalyticsPage() {
  const supabase = createClient()
  const clubId = await getClubId()

  const filter = (q: any) => clubId ? q.eq('club_id', clubId) : q

  const [
    { count: totalStudents },
    { count: totalCoaches },
    { data: payments },
    { data: levels },
    { data: bagStats },
  ] = await Promise.all([
    filter(supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true)),
    filter(supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'coach').eq('is_active', true)),
    filter(supabase.from('payments').select('amount, type, status, currency').eq('status', 'succeeded')),
    filter(supabase.from('levels').select('id, name, color, users(count)')).order('order'),
    filter(supabase.from('class_bag').select('balance')),
  ])

  const totalRevenue = payments?.reduce((acc: number, p: any) => acc + p.amount, 0) ?? 0
  const revenueByType = (payments ?? []).reduce((acc: Record<string, number>, p: any) => {
    acc[p.type] = (acc[p.type] ?? 0) + p.amount
    return acc
  }, {} as Record<string, number>)

  const totalBagClasses = bagStats?.reduce((acc: number, b: any) => acc + (b.balance ?? 0), 0) ?? 0

  const typeLabel: Record<string, string> = {
    subscription: 'Suscripción',
    pay_per_class: 'Clase suelta',
    bag_pack: 'Bono de clases',
    manual: 'Manual',
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
        <p className="text-sm text-gray-500">Resumen de actividad</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Alumnos activos</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totalStudents ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Monitores</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totalCoaches ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Ingresos totales</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Clases disponibles</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totalBagClasses}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Ingresos por tipo</h2>
          {Object.keys(revenueByType).length === 0 && (
            <p className="text-sm text-gray-400">Sin datos de pagos aún.</p>
          )}
          <div className="space-y-3">
            {Object.entries(revenueByType).map(([type, amount]) => {
              const amt = amount as number
              const pct = totalRevenue > 0 ? Math.round((amt / totalRevenue) * 100) : 0
              return (
                <div key={type}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-700">{typeLabel[type] ?? type}</span>
                    <span className="font-medium text-gray-900">{formatCurrency(amt)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Alumnos por nivel</h2>
          {levels?.length === 0 && (
            <p className="text-sm text-gray-400">No hay niveles creados.</p>
          )}
          <div className="space-y-3">
            {levels?.map((level: any) => {
              const count = level.users?.[0]?.count ?? 0
              const max = Math.max(...(levels.map((l: any) => l.users?.[0]?.count ?? 0)), 1)
              const pct = Math.round((count / max) * 100)
              return (
                <div key={level.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: level.color }} />
                      <span className="text-gray-700">{level.name}</span>
                    </span>
                    <span className="font-medium text-gray-900">{count} alumnos</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: level.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
