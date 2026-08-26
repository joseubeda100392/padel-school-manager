import type { SupabaseClient } from '@supabase/supabase-js'

// Efectos que se disparan al confirmar (admin) una sesión de clase del
// módulo de validación. Se llama exactamente una vez por sesión — el
// llamador debe garantizar que confirmed_by_admin pasa de null a un valor
// en la misma operación que invoca esto, para que no se aplique dos veces.
//
// - Clase dada: los alumnos ausentes marcados aquí son solo el respaldo del
//   admin para cuando el alumno no canceló a tiempo por su cuenta (el
//   camino correcto es que el alumno registre su falta dentro del plazo de
//   cancelación, que ya suma la clase a su bolsa automáticamente en otro
//   sitio). Por eso esto NO genera ningún crédito ni recuperación
//   automática — si el admin quiere darle la clase de todos modos, lo hace
//   a mano desde el ajuste de bolsa del alumno. Aquí solo queda constancia
//   de la ausencia (class_session_absences), sin más efecto.
// - Clase no dada: cada inscripción activa de ese grupo suma 1 a su
//   contador de clases pendientes de descontar del siguiente cobro.
export async function applySessionEffects(admin: SupabaseClient, sessionId: string): Promise<void> {
  const { data: session } = await admin
    .from('class_sessions')
    .select('id, schedule_id, club_id, session_date, status')
    .eq('id', sessionId)
    .single()
  if (!session) return

  if (session.status === 'not_given') {
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
