export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { rateLimit } from '@/lib/rate-limit'
import { checkOverlap, checkCoachOverlap, findExactDuplicate } from '@/lib/schedule-overlap'

interface ImportRow {
  pista: string
  monitor: string
  nivel: string
  start_time: string
  end_time: string
  recurrence: 'none' | 'weekly' | 'biweekly'
  recurrence_end_date: string | null
  max_students: number
  type: 'regular' | 'intensivo'
  price_cents: number | null
  court_id?: string
  coach_id?: string
  level_id?: string
}

const normalize = (s: string) => s.toLowerCase().trim()

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'admin-import-schedules', { limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const clubId = await getClubId() ?? caller.club_id
  if (!clubId) return NextResponse.json({ error: 'Club no identificado' }, { status: 400 })

  const { rows }: { rows: ImportRow[] } = await req.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows requerido' }, { status: 400 })
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Máximo 500 clases por importación' }, { status: 400 })
  }

  const [{ data: courts }, { data: coaches }, { data: levels }] = await Promise.all([
    admin.from('courts').select('id, name').eq('club_id', clubId).eq('is_active', true),
    admin.from('users').select('id, name').eq('club_id', clubId).eq('role', 'coach').eq('is_active', true),
    admin.from('levels').select('id, name').eq('club_id', clubId),
  ])
  const courtById = new Set((courts ?? []).map((c: any) => c.id))
  const coachById = new Set((coaches ?? []).map((c: any) => c.id))
  const levelById = new Set((levels ?? []).map((l: any) => l.id))
  const courtByName: Record<string, string> = Object.fromEntries((courts ?? []).map((c: any) => [normalize(c.name), c.id]))
  const coachByName: Record<string, string> = Object.fromEntries((coaches ?? []).map((c: any) => [normalize(c.name), c.id]))
  const levelByName: Record<string, string> = Object.fromEntries((levels ?? []).map((l: any) => [normalize(l.name), l.id]))

  const results: { row: number; status: 'ok' | 'skipped' | 'error'; label: string; error?: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const label = `${row.pista || '?'} · ${row.monitor || '?'} · ${row.start_time ?? ''}`

    const courtId = row.court_id && courtById.has(row.court_id) ? row.court_id : courtByName[normalize(row.pista ?? '')]
    if (!courtId) {
      results.push({ row: i, status: 'error', label, error: `Pista "${row.pista}" no encontrada en el club` })
      continue
    }
    const coachId = row.coach_id && coachById.has(row.coach_id) ? row.coach_id : coachByName[normalize(row.monitor ?? '')]
    if (!coachId) {
      results.push({ row: i, status: 'error', label, error: `Monitor "${row.monitor}" no encontrado en el club` })
      continue
    }
    const levelId = row.nivel
      ? (row.level_id && levelById.has(row.level_id) ? row.level_id : levelByName[normalize(row.nivel)] ?? null)
      : null

    if (!row.start_time || !row.end_time) {
      results.push({ row: i, status: 'error', label, error: 'Falta hora de inicio o fin' })
      continue
    }

    try {
      const isDuplicate = await findExactDuplicate(admin, courtId, row.start_time, row.end_time)
      if (isDuplicate) {
        results.push({ row: i, status: 'skipped', label, error: 'Ya existe una clase idéntica — no se duplica' })
        continue
      }

      const [courtBusy, coachBusy] = await Promise.all([
        checkOverlap(admin, courtId, row.start_time, row.end_time, row.recurrence_end_date),
        checkCoachOverlap(admin, coachId, row.start_time, row.end_time, row.recurrence_end_date),
      ])
      if (courtBusy) {
        results.push({ row: i, status: 'error', label, error: 'La pista ya tiene otra clase activa a esa hora' })
        continue
      }
      if (coachBusy) {
        results.push({ row: i, status: 'error', label, error: 'El monitor ya tiene otra clase a esa hora' })
        continue
      }

      const { error: insertErr } = await admin.from('schedules').insert({
        court_id: courtId,
        coach_id: coachId,
        level_id: levelId,
        start_time: row.start_time,
        end_time: row.end_time,
        recurrence: row.recurrence,
        recurrence_end_date: row.recurrence_end_date,
        max_students: row.max_students,
        is_active: true,
        club_id: clubId,
        type: row.type,
        price_cents: row.price_cents,
      })

      if (insertErr) {
        results.push({ row: i, status: 'error', label, error: 'Error al crear la clase' })
        continue
      }

      results.push({ row: i, status: 'ok', label })
    } catch {
      results.push({ row: i, status: 'error', label, error: 'Error inesperado al importar la fila' })
    }
  }

  return NextResponse.json({ results })
}
