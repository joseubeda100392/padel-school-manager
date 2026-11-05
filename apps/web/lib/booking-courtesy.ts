import type { SupabaseClient } from '@supabase/supabase-js'

// Reserva puntual de prueba o cortesía: apuntada por el club sin descontar
// bolsa ni cobrar. Se guarda como source 'admin', confirmada, con esta nota.
export const COURTESY_NOTE = 'cortesia'

// Origen que se enseña en las listas: la cortesía aparte de las demás 'admin'.
export function spotSourceOf(b: { source: string; notes?: string | null }): string {
  return b.notes === COURTESY_NOTE ? 'courtesy' : b.source
}

export const courtesyReason = (classDate: string) =>
  `Cortesía: clase del ${classDate.slice(8, 10)}/${classDate.slice(5, 7)}/${classDate.slice(0, 4)} (no descuenta)`

// Apunte de 0 clases en el historial de su bolsa, como rastro de la cortesía.
// Tipo 'credit' para que las devoluciones (que buscan débitos) no lo cuenten.
export async function recordCourtesy(
  admin: SupabaseClient, studentId: string, clubId: string | null, bookingId: string, classDate: string,
): Promise<{ message: string } | null> {
  let { data: bag } = await admin.from('class_bag').select('id').eq('user_id', studentId).maybeSingle()
  if (!bag) {
    const { data: created, error } = await admin.from('class_bag')
      .upsert({ user_id: studentId, club_id: clubId, balance_60: 0, balance_90: 0 }, { onConflict: 'user_id' })
      .select('id').single()
    if (error) return error
    bag = created
  }
  const { error } = await admin.from('bag_transactions').insert({
    user_id: studentId,
    class_bag_id: bag!.id,
    club_id: clubId,
    delta: 0,
    type: 'credit',
    reason: courtesyReason(classDate),
    booking_id: bookingId,
  })
  return error
}
