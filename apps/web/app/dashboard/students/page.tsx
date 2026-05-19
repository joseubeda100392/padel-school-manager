import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId, isSuperAdmin } from '@/lib/get-club'
import StudentsTable from './students-table'

export default async function StudentsPage() {
  const admin = getAdminClient()
  const [clubId, superAdmin] = await Promise.all([getClubId(), isSuperAdmin()])

  let studentsQuery = admin
    .from('users')
    .select('id, name, email, role, is_active, email_confirmed, created_at, current_level_id, avatar_url, start_date, end_date')
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <nav className="mb-1 flex items-center gap-1 text-[12px] text-gray-400">
            <span>Dashboard</span><span className="mx-1">/</span>
            <span className="font-semibold text-[#006b2c]">Alumnos</span>
          </nav>
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Gestión de Alumnos</h1>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {students?.length ?? 0} total
            </span>
          </div>
          {error && <p className="mt-1 text-[12px] text-red-500">Error: {error.message}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/dashboard/students/import"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-gray-600 shadow-sm hover:bg-gray-50 transition-all">
            ↑ Importar Excel
          </a>
          <a href="/dashboard/students/new"
            className="flex items-center gap-2 rounded-xl bg-[#006b2c] px-4 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-[#006b2c]/20 hover:bg-[#005320] transition-all active:scale-95">
            + Nuevo usuario
          </a>
        </div>
      </div>
      <StudentsTable students={students ?? []} levelMap={levelMap} />
    </div>
  )
}
