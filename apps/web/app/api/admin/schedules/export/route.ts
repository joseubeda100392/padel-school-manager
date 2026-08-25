export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getDayOfWeek } from '@/lib/utils'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const RECURRENCE_LABEL: Record<string, string> = { none: 'Ninguna (clase suelta)', weekly: 'Semanal', biweekly: 'Quincenal' }

// Copia de seguridad del calendario de clases en Excel — pensado para poder
// volver a subir el mismo fichero con /dashboard/schedule/restore si se
// pierde información. Incluye columnas legibles (nombres) y columnas de
// máquina (ids) al final para que el reimportado sea exacto.
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const cookieStore = cookies()
  const clubId = caller.role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? caller.club_id)
    : caller.club_id

  const query = admin
    .from('schedules')
    .select('id, start_time, end_time, recurrence, recurrence_end_date, max_students, type, price_cents, court_id, coach_id, level_id, court:courts(name), coach:users!schedules_coach_id_fkey(name), level:levels(name)')
    .eq('is_active', true)
    .order('start_time')
  const { data: schedules, error } = await (clubId ? query.eq('club_id', clubId) : query)

  if (error) return NextResponse.json({ error: 'Error al leer las clases' }, { status: 500 })

  const rows = (schedules ?? []).map((s: any) => ({
    'Pista': s.court?.name ?? '',
    'Monitor': s.coach?.name ?? '',
    'Nivel': s.level?.name ?? '',
    'Día': DAYS[getDayOfWeek(s.start_time)],
    'Hora inicio': new Date(s.start_time).toISOString().slice(11, 16),
    'Hora fin': new Date(s.end_time).toISOString().slice(11, 16),
    'Recurrencia': RECURRENCE_LABEL[s.recurrence] ?? s.recurrence,
    'Fin recurrencia': s.recurrence_end_date ?? '',
    'Plazas máx': s.max_students,
    'Tipo': s.type === 'intensivo' ? 'Intensivo' : 'Regular',
    'Precio (€)': s.price_cents ? (s.price_cents / 100).toFixed(2) : '',
    // Columnas de máquina — no las edites a mano, se usan para restaurar exacto.
    'court_id': s.court_id,
    'coach_id': s.coach_id,
    'level_id': s.level_id ?? '',
    'start_time': s.start_time,
    'end_time': s.end_time,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 11 }, { wch: 10 },
    { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 36 }, { wch: 36 }, { wch: 36 }, { wch: 24 }, { wch: 24 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Clases')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="calendario_clases_${today}.xlsx"`,
    },
  })
}
