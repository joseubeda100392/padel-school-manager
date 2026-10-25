import type { SupabaseClient } from '@supabase/supabase-js'

// Salida de un alumno de un grupo fijo sin perder el historial. lastDay es su
// último día en el grupo. La inscripción no se borra: queda con end_date y,
// cuando ese día ya ha pasado, con status 'ended' (todo lo de "ahora" filtra
// por 'active', así que deja de contar para aforo, listas y cobros futuros, y
// las clases pasadas siguen mostrándolo con sus faltas).
// - Si aún no había empezado en el grupo (start_date posterior), no hay
//   historial que guardar: se borra.
// - Las faltas posteriores a lastDay sobran y se borran.
// - Si al terminar ya no le queda ningún grupo, se le desactiva (como una baja).
export type EndResult = 'deleted' | 'ended' | 'scheduled'

export async function endEnrollment(
  admin: SupabaseClient,
  enrollment: { id: string; student_id: string; start_date: string | null },
  lastDay: string,
  today: string,
): Promise<EndResult> {
  if (enrollment.start_date && enrollment.start_date > lastDay) {
    await admin.from('schedule_exclusions').delete().eq('group_enrollment_id', enrollment.id)
    const { error } = await admin.from('group_enrollments').delete().eq('id', enrollment.id)
    if (error) throw new Error(error.message)
    return 'deleted'
  }

  await admin.from('schedule_exclusions').delete().eq('group_enrollment_id', enrollment.id).gt('excluded_date', lastDay)

  if (lastDay >= today) {
    const { error } = await admin.from('group_enrollments').update({ end_date: lastDay }).eq('id', enrollment.id)
    if (error) throw new Error(error.message)
    return 'scheduled'
  }

  const { error } = await admin.from('group_enrollments').update({ end_date: lastDay, status: 'ended' }).eq('id', enrollment.id)
  if (error) throw new Error(error.message)
  await deactivateIfNoGroups(admin, enrollment.student_id)
  return 'ended'
}

export async function deactivateIfNoGroups(admin: SupabaseClient, studentId: string): Promise<boolean> {
  const { count } = await admin
    .from('group_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('status', 'active')
  if ((count ?? 0) > 0) return false
  await admin.from('users').update({ is_active: false }).eq('id', studentId)
  return true
}
