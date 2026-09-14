export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: caller } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!caller || !['admin', 'super_admin', 'coach'].includes(caller.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { studentId, title } = await req.json()
  if (!studentId || !title?.trim()) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const { data: student } = await admin.from('users').select('club_id').eq('id', studentId).single()
  if (caller.role !== 'super_admin' && (!student || student.club_id !== caller.club_id)) {
    return NextResponse.json({ error: 'Alumno no pertenece a tu club' }, { status: 403 })
  }

  // El club del checklist es el del propio alumno, no el del que lo crea —
  // para un super_admin (sin club propio) esto evitaba que quedara con
  // club_id NULL.
  const { data, error } = await admin
    .from('student_checklists')
    .insert({ student_id: studentId, coach_id: user.id, club_id: student?.club_id ?? null, title: title.trim() })
    .select('id, title, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Error al crear el checklist' }, { status: 400 })
  return NextResponse.json({ data })
}
