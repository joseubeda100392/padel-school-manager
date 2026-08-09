import type { SupabaseClient } from '@supabase/supabase-js'

// Efectos que se disparan al confirmar (admin) una sesión de clase del
// módulo de validación. Se llama exactamente una vez por sesión — el
// llamador debe garantizar que confirmed_by_admin pasa de null a un valor
// en la misma operación que invoca esto, para que no se aplique dos veces.
//
// - Clase dada: cada alumno marcado ausente genera una recuperación
//   (tabla makeups ya existente en la app).
// - Clase no dada: cada inscripción activa de ese grupo suma 1 a su
//   contador de clases pendientes de descontar del siguiente cobro.
export async function applySessionEffects(admin: SupabaseClient, sessionId: string): Promise<void> {
  const { data: session } = await admin
    .from('class_sessions')
    .select('id, schedule_id, club_id, session_date, status')
    .eq('id', sessionId)
    .single()
  if (!session) return

  if (session.status === 'given') {
    const { data: absences } = await admin
      .from('class_session_absences')
      .select('id, student_id, makeup_id')
      .eq('class_session_id', sessionId)
      .is('makeup_id', null)

    for (const absence of absences ?? []) {
      const { data: makeup, error: makeupErr } = await admin
        .from('makeups')
        .insert({
          student_id: absence.student_id,
          club_id: session.club_id,
          original_schedule_id: session.schedule_id,
          original_date: session.session_date,
          status: 'pending',
          notes: 'Generada automáticamente: falta en clase validada',
        })
        .select('id')
        .single()
      if (makeupErr) {
        console.error('[class-session-effects] makeup insert failed:', makeupErr.message)
        continue
      }
      await admin.from('class_session_absences').update({ makeup_id: makeup.id }).eq('id', absence.id)
    }
  } else if (session.status === 'not_given') {
    const { data: enrollments } = await admin
      .from('group_enrollments')
      .select('id, discount_classes_pending')
      .eq('schedule_id', session.schedule_id)
      .eq('status', 'active')

    for (const enrollment of enrollments ?? []) {
      await admin
        .from('group_enrollments')
        .update({ discount_classes_pending: (enrollment.discount_classes_pending ?? 0) + 1 })
        .eq('id', enrollment.id)
    }
  }
}
