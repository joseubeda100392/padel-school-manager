import type { SupabaseClient } from '@supabase/supabase-js'
import { madridToday } from '@/lib/enrollment-window'
import { madridDayOfWeek } from '@/lib/madrid-time'

export interface AvailableGroup {
  id: string
  label: string
  full: boolean
}

const madridDay = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short' })
const madridTime = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })

// Grupos fijos del club a los que se puede cambiar a un alumno ("Cambiar de
// grupo"), con la ocupación de hoy solo como orientación: la ruta comprueba
// plaza y horario de verdad, en la fecha del cambio, al guardar. No ofrece los
// grupos que ya han terminado (recurrence_end_date pasada).
export async function loadAvailableGroups(admin: SupabaseClient, clubId: string): Promise<AvailableGroup[]> {
  const today = madridToday()
  const { data } = await admin
    .from('schedules')
    .select('id, start_time, end_time, max_students, type, is_private, recurrence_end_date, court:courts(name), level:levels(name), group_enrollments(status)')
    .eq('club_id', clubId)
    .eq('is_active', true)
  return (data ?? [])
    .filter((sc: any) => (sc.type ?? 'regular') === 'regular' && !sc.is_private && (!sc.recurrence_end_date || sc.recurrence_end_date >= today))
    .map((sc: any) => {
      const occupied = (sc.group_enrollments ?? []).filter((g: any) => g.status === 'active').length
      const start = new Date(sc.start_time)
      return {
        id: sc.id as string,
        sortKey: `${(madridDayOfWeek(start) + 6) % 7}-${madridTime.format(start)}`,
        label: `${madridDay.format(start)} ${madridTime.format(start)}–${madridTime.format(new Date(sc.end_time))} · ${sc.court?.name ?? '—'}${sc.level?.name ? ` · ${sc.level.name}` : ''} · ${occupied}/${sc.max_students}`,
        full: !!sc.max_students && occupied >= sc.max_students,
      }
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ sortKey: _s, ...g }) => g)
}
