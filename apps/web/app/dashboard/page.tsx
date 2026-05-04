import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { Users, CalendarDays, CreditCard, BookOpen } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createClient()
  const clubId = await getClubId()

  const filter = (q: any) => clubId ? q.eq('club_id', clubId) : q

  const [
    { count: totalStudents },
    { count: totalMaterials },
    { data: classesToday },
    { data: pendingPayments },
    { data: recentStudents },
  ] = await Promise.all([
    filter(supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true)),
    filter(supabase.from('materials').select('id', { count: 'exact', head: true }).eq('is_published', true)),
    supabase.rpc('count_classes_today', { p_club_id: clubId ?? null }),
    supabase.rpc('count_pending_payments', { p_club_id: clubId ?? null }),
    filter(supabase.from('users').select('id,name,email,created_at').eq('role', 'student').order('created_at', { ascending: false }).limit(5)),
  ])

  const stats = [
    { label: 'Alumnos activos', value: totalStudents ?? 0, icon: Users, color: 'bg-blue-500' },
    { label: 'Clases hoy', value: (classesToday as number) ?? 0, icon: CalendarDays, color: 'bg-green-500' },
    { label: 'Cobros pendientes', value: (pendingPayments as number) ?? 0, icon: CreditCard, color: 'bg-yellow-500' },
    { label: 'Materiales publicados', value: totalMaterials ?? 0, icon: BookOpen, color: 'bg-purple-500' },
  ]

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Panel de Control</h1>
      <p className="mb-8 text-gray-500">Resumen de la actividad de tu escuela de pádel.</p>

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl bg-white p-6 shadow-sm">
            <div className={`mb-4 inline-flex rounded-lg p-2 ${stat.color}`}>
              <stat.icon className="h-5 w-5 text-white" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Últimos alumnos registrados</h2>
        {recentStudents?.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no hay alumnos. <a href="/dashboard/students/new" className="text-green-600 hover:underline">Crea el primero</a>.</p>
        ) : (
          <ul className="space-y-3">
            {recentStudents?.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.email}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
