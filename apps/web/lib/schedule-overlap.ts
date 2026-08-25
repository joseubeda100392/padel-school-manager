import type { SupabaseClient } from '@supabase/supabase-js'

const TZ = 'Europe/Madrid'

function toMinutes(iso: string): number {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function dateOnly(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso))
}

export function overlaps(
  startTime: string, endTime: string, newEndDate: string | null | undefined,
  existing: { start_time: string; end_time: string; recurrence_end_date: string | null }[]
): boolean {
  const dow = new Date(startTime).getUTCDay()
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  const newStartDate = dateOnly(startTime)

  return existing.some(s => {
    if (new Date(s.start_time).getUTCDay() !== dow) return false
    if (start >= toMinutes(s.end_time) || end <= toMinutes(s.start_time)) return false
    const sStartDate = dateOnly(s.start_time)
    if (newEndDate && sStartDate > newEndDate) return false
    if (s.recurrence_end_date && newStartDate > s.recurrence_end_date) return false
    return true
  })
}

export async function checkOverlap(
  admin: SupabaseClient, courtId: string, startTime: string, endTime: string,
  newEndDate: string | null | undefined, excludeId?: string,
): Promise<boolean> {
  const query = admin.from('schedules').select('id, start_time, end_time, recurrence_end_date').eq('court_id', courtId).eq('is_active', true)
  const { data } = await (excludeId ? query.neq('id', excludeId) : query)
  return overlaps(startTime, endTime, newEndDate, data ?? [])
}

export async function checkCoachOverlap(
  admin: SupabaseClient, coachId: string, startTime: string, endTime: string,
  newEndDate: string | null | undefined, excludeId?: string,
): Promise<boolean> {
  const query = admin.from('schedules').select('id, start_time, end_time, recurrence_end_date').eq('coach_id', coachId).eq('is_active', true)
  const { data } = await (excludeId ? query.neq('id', excludeId) : query)
  return overlaps(startTime, endTime, newEndDate, data ?? [])
}

// Duplicado exacto: misma pista, mismo inicio y mismo fin ya activos —
// distinto de un solape (que puede ser un conflicto real con OTRA clase).
export async function findExactDuplicate(
  admin: SupabaseClient, courtId: string, startTime: string, endTime: string,
): Promise<boolean> {
  const { data } = await admin
    .from('schedules')
    .select('id')
    .eq('court_id', courtId)
    .eq('start_time', startTime)
    .eq('end_time', endTime)
    .eq('is_active', true)
    .limit(1)
  return (data?.length ?? 0) > 0
}
