import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushToUsers } from '@/lib/push'
import { canTakeSpot, parseLowerLevelMap } from '@/lib/spot-levels'
import { formatTime } from '@/lib/utils'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// Aviso de hueco libre a los alumnos del club que pueden cogerlo (su nivel o
// el que el club deja recuperar; sin nivel, cualquiera), menos los del grupo,
// quien ya tiene plaza ese día y quien ha apagado los avisos de huecos.
// Nunca interrumpe a quien lo llama: si falla, no se avisa y ya.
export async function notifySpotAvailable(admin: SupabaseClient, scheduleId: string, date: string): Promise<void> {
  try {
    const { data: sc } = await admin
      .from('schedules')
      .select('start_time, club_id, level_id, court:courts(name), level:levels(name), club:clubs(config)')
      .eq('id', scheduleId)
      .single()
    if (!sc) return

    const [{ data: enrolled }, { data: booked }] = await Promise.all([
      admin.from('group_enrollments').select('student_id').eq('schedule_id', scheduleId).eq('status', 'active'),
      admin.from('bookings').select('student_id').eq('schedule_id', scheduleId).eq('class_date', date).neq('status', 'cancelled'),
    ])
    const excluded = new Set([...(enrolled ?? []), ...(booked ?? [])].map((e: any) => e.student_id))

    let q = admin.from('users').select('id, current_level_id').eq('role', 'student').eq('is_active', true).eq('spot_alerts', true)
    if ((sc as any).club_id) q = q.eq('club_id', (sc as any).club_id)
    const { data: candidates } = await q
    const levelMap = parseLowerLevelMap((sc as any).club?.config)
    const targetIds = (candidates ?? [])
      .filter((u: any) => !excluded.has(u.id) && canTakeSpot(u.current_level_id, (sc as any).level_id ?? null, levelMap))
      .map((u: any) => u.id)
    if (!targetIds.length) return

    const startDt = new Date((sc as any).start_time)
    const levelName = (sc as any).level?.name ? ` · ${(sc as any).level.name}` : ''
    const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    await sendPushToUsers(targetIds, {
      title: '🎾 ¡Hueco libre disponible!',
      body: `${DAY_NAMES[startDt.getDay()]} ${dateLabel} a las ${formatTime(startDt)}${levelName} — ${(sc as any).court?.name ?? ''}`,
      url: '/student/spots',
    }, 'spot_available')
  } catch (err) {
    console.error('[spot-alerts] aviso de hueco no enviado', scheduleId, date, err)
  }
}
