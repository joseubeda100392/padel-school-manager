import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId, isSuperAdmin } from '@/lib/get-club'
import StudentsTable from './students-table'

export default async function StudentsPage() {
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500">{students?.length ?? 0} usuarios registrados</p>
          {error && <p className="mt-1 text-xs text-red-500">Error: {error.message}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/dashboard/students/import"
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
          >
            ↑ Importar Excel
          </a>
          <a
            href="/dashboard/students/new"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            + Nuevo usuario
          </a>
        </div>
      </div>

      <StudentsTable students={students ?? []} levelMap={levelMap} />
    </div>
  )
}
