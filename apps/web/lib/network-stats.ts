// Cifras de cada sede para la vista de la red. Mismos cálculos que el panel
// del club (alumnos, monitores, clases de hoy) y que Pagos (cobrado del mes
// que se factura y pendiente), para que cuadren con lo que ve cada sede.

import { getAdminClient } from '@/lib/supabase/admin'
import { loadMonthPayments } from '@/lib/payments-month'
import { COACH_USERS_FILTER } from '@/lib/coach-role'

type Admin = ReturnType<typeof getAdminClient>

export interface ClubStats {
  id: string
  name: string
  students: number
  coaches: number
  classesToday: number
  groupsWithSpots: number
  collected: number
  pendingAmount: number
  pendingStudents: number
}

export async function loadClubStats(admin: Admin, club: { id: string; name: string }, year: number, month0: number): Promise<ClubStats> {
  const { data: clubRow } = await admin.from('clubs').select('config').eq('id', club.id).single()
  const billingStart: string | null = (clubRow as any)?.config?.billing_start_date ?? null
  const todayMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  const billingActive = !billingStart || todayMadrid >= billingStart

  const [students, coaches, classesToday, schedules, monthPayments, pending] = await Promise.all([
    admin.from('users').select('id', { count: 'exact', head: true }).eq('club_id', club.id).eq('role', 'student').eq('is_active', true),
    admin.from('users').select('id', { count: 'exact', head: true }).eq('club_id', club.id).or(COACH_USERS_FILTER).eq('is_active', true),
    admin.rpc('count_classes_today', { p_club_id: club.id }),
    admin.from('schedules').select('max_students, enrollments:group_enrollments(status)').eq('club_id', club.id).eq('is_active', true).eq('is_private', false),
    loadMonthPayments(admin, club.id, year, month0),
    billingActive
      ? admin.rpc('get_pending_payments', { p_club_id: club.id, p_year: year, p_month: month0 + 1 })
      : Promise.resolve({ data: [] as any[] }),
  ])

  const groupsWithSpots = ((schedules.data ?? []) as any[]).filter(s =>
    ((s.enrollments ?? []) as any[]).filter(e => e.status === 'active').length < (s.max_students ?? 0)
  ).length
  const unpaid = ((pending as any).data ?? []) as any[]

  return {
    id: club.id,
    name: club.name,
    students: students.count ?? 0,
    coaches: coaches.count ?? 0,
    classesToday: (classesToday.data as number) ?? 0,
    groupsWithSpots,
    collected: monthPayments.payments.reduce((acc, p: any) => (p.status === 'succeeded' ? acc + p.amount : acc), 0),
    pendingAmount: unpaid.reduce((acc, u: any) => acc + (u.monthly_price ?? 0), 0),
    pendingStudents: new Set(unpaid.map((u: any) => u.student_id ?? u.id)).size,
  }
}
