export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { StudentObjectives } from '@/app/dashboard/students/[id]/student-objectives'
import Link from 'next/link'

export default async function CoachStudentPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()

  const { data: coach } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!coach || coach.role !== 'coach') redirect('/coach')

  const { data: coachSchedules } = await admin
    .from('schedules')
    .select('id')
    .eq('coach_id', user.id)

  const scheduleIds = (coachSchedules ?? []).map((s: any) => s.id)

  const [{ data: student }, { data: checklists }, { data: enrollment }] = await Promise.all([
    admin.from('users').select('id, name, email, current_level_id').eq('id', params.id).single(),
    admin
      .from('student_checklists')
      .select('id, title, created_at, completed_at, items:checklist_items(id, text, sort_order, completed_at, completed_by_id)')
      .eq('student_id', params.id)
      .order('created_at', { ascending: false }),
    scheduleIds.length > 0
      ? admin
          .from('group_enrollments')
          .select('id')
          .eq('student_id', params.id)
          .eq('status', 'active')
          .in('schedule_id', scheduleIds)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!student || !enrollment) notFound()

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/coach/classes" className="text-sm text-gray-500 hover:text-gray-700">← Mis Clases</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">{student.name}</h1>
      </div>

      <StudentObjectives
        studentId={params.id}
        initialChecklists={(checklists ?? []).map((c: any) => ({
          id: c.id,
          title: c.title,
          created_at: c.created_at,
          completed_at: c.completed_at,
          items: (c.items ?? []).map((it: any) => ({
            id: it.id,
            text: it.text,
            sort_order: it.sort_order,
            completed_at: it.completed_at,
            completed_by_id: it.completed_by_id,
          })),
        }))}
      />
    </div>
  )
}
