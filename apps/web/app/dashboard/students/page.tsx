export const dynamic = 'force-dynamic'

import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId, isSuperAdmin } from '@/lib/get-club'
import StudentsTable from './students-table'
import { RealtimeRefresh } from '@/components/realtime-refresh'

export default async function StudentsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const admin = getAdminClient()
  const [clubId, superAdmin] = await Promise.all([getClubId(), isSuperAdmin()])

  let studentsQuery = admin
    .from('users')
    .select('id, name, email, role, is_active, created_at, current_level_id, avatar_url, start_date, end_date')
    .neq('role', 'super_admin')
    .order('name')

  let levelsQuery = admin.from('levels').select('id, name, color')

  if (clubId) {
    studentsQuery = studentsQuery.eq('club_id', clubId)
    levelsQuery = levelsQuery.eq('club_id', clubId)
  }

  const [{ data: students, error }, { data: levels }] = await Promise.all([
    studentsQuery,
    levelsQuery,
  ])

  const levelMap = Object.fromEntries((levels ?? []).map((l: any) => [l.id, l]))

  return (
    <div>
      <RealtimeRefresh
        channelName="admin-students"
        subs={[{ table: 'users' }]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="mt-1 text-sm text-gray-500">{students?.length ?? 0} usuarios registrados</p>
          {error && <p className="mt-1 text-xs text-red-500">Error: {error.message}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/dashboard/students/import"
            className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            ↑ Importar Excel
          </a>
          <a
            href="/dashboard/students/new"
            className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            + Nuevo usuario
          </a>
        </div>
      </div>

      <StudentsTable students={students ?? []} levelMap={levelMap} defaultTab={searchParams.tab ?? 'student'} />
    </div>
  )
}
