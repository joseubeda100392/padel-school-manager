export const dynamic = 'force-dynamic'

import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId, isSuperAdmin } from '@/lib/get-club'
import Link from 'next/link'
import { Plus, Upload } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
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
    <div className="space-y-6">
      <RealtimeRefresh
        channelName="admin-students"
        subs={clubId ? [{ table: 'users', filter: `club_id=eq.${clubId}` }] : [{ table: 'users' }]}
      />
      <PageHeader
        title="Usuarios"
        description={`${students?.length ?? 0} usuarios registrados`}
        actions={
          <>
            <Link href="/dashboard/students/import" className={buttonVariants({ variant: 'secondary', className: 'flex-1 sm:flex-none' })}>
              <Upload className="h-4 w-4" aria-hidden />
              Importar Excel
            </Link>
            <Link href="/dashboard/students/new" className={buttonVariants({ variant: 'primary', className: 'flex-1 sm:flex-none' })}>
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo usuario
            </Link>
          </>
        }
      />
      {error && <Notice tone="danger">No se han podido cargar los usuarios: {error.message}</Notice>}

      <StudentsTable students={students ?? []} levelMap={levelMap} enrollmentMap={enrollmentMap} defaultTab={searchParams.tab ?? 'student'} />
    </div>
  )
}
