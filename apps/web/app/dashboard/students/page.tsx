export const dynamic = 'force-dynamic'

import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId, isSuperAdmin } from '@/lib/get-club'
import Link from 'next/link'
import StudentsTable from './students-table'
import { RealtimeRefresh } from '@/components/realtime-refresh'

export default async function StudentsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const admin = getAdminClient()
  const [clubId, superAdmin] = await Promise.all([getClubId(), isSuperAdmin()])

  let studentsQuery = admin
    .from('users')
    .select('id, name, email, phone, role, is_active, created_at, current_level_id, avatar_url, start_date, end_date, terms_accepted_at, also_student')
    .neq('role', 'super_admin')
    .order('name')

  let levelsQuery = admin.from('levels').select('id, name, color')
  let enrollmentsQuery = admin.from('group_enrollments').select('student_id, id, monthly_price').eq('status', 'active')

  if (clubId) {
    studentsQuery = studentsQuery.eq('club_id', clubId)
    levelsQuery = levelsQuery.eq('club_id', clubId)
    enrollmentsQuery = enrollmentsQuery.eq('club_id', clubId)
  }

  const [{ data: students, error }, { data: levels }, { data: enrollments }] = await Promise.all([
    studentsQuery,
    levelsQuery,
    enrollmentsQuery,
  ])

  const levelMap = Object.fromEntries((levels ?? []).map((l: any) => [l.id, l]))

  type EnrollmentSummary = { total: number; id: string | null }
  const enrollmentMap: Record<string, EnrollmentSummary> = {}
  for (const e of enrollments ?? []) {
    if (!enrollmentMap[e.student_id]) {
      enrollmentMap[e.student_id] = { total: e.monthly_price, id: e.id }
    } else {
      enrollmentMap[e.student_id].total += e.monthly_price
      enrollmentMap[e.student_id].id = null
    }
  }

  return (
    <div>
      <RealtimeRefresh
        channelName="admin-students"
        subs={clubId ? [{ table: 'users', filter: `club_id=eq.${clubId}` }] : [{ table: 'users' }]}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="mt-1 text-sm text-gray-500">{students?.length ?? 0} usuarios registrados</p>
          {error && <p className="mt-1 text-xs text-red-500">Error: {error.message}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/students/import"
            className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            ↑ Importar Excel
          </Link>
          <Link
            href="/dashboard/students/new"
            className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            + Nuevo usuario
          </Link>
        </div>
      </div>

      <StudentsTable students={students ?? []} levelMap={levelMap} enrollmentMap={enrollmentMap} defaultTab={searchParams.tab ?? 'student'} />
    </div>
  )
}
