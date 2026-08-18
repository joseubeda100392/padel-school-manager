import type { SupabaseClient } from '@supabase/supabase-js'
import { mostCommonMonthlyPrice } from '@/lib/utils'

// Descuento pensado como algo puntual (ej. "solo el primer mes"), no una
// rebaja permanente: en cuanto se registra el pago del mes descontado
// (efectivo o Redsys), se resetea aquí para que el mes siguiente vuelva
// solo al precio normal — si el admin lo quiere aplicar otra vez, marca
// el check de nuevo.
export async function resetEnrollmentDiscountAfterPayment(
  admin: SupabaseClient,
  enrollmentId: string,
): Promise<void> {
  const { data: enrollment } = await admin
    .from('group_enrollments')
    .select('discount_applied, monthly_price, schedule_id, club_id')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment?.discount_applied) return

  const { data: siblings } = await admin
    .from('group_enrollments')
    .select('monthly_price')
    .eq('schedule_id', enrollment.schedule_id)
    .eq('status', 'active')
    .eq('discount_applied', false)
    .neq('id', enrollmentId)

  let normalPrice = mostCommonMonthlyPrice(siblings ?? [])

  // Sin otras inscripciones sin descuento en el grupo con las que inferir
  // el precio normal (ej. alumno único en su grupo) — se deshace el
  // descuento conocido sobre el precio actual en vez de adivinar.
  if (normalPrice <= 0) {
    const { data: club } = enrollment.club_id
      ? await admin.from('clubs').select('config').eq('id', enrollment.club_id).single()
      : { data: null }
    const discountCents = (club as any)?.config?.standard_discount_cents ?? 4000
    normalPrice = enrollment.monthly_price + discountCents
  }

  await admin
    .from('group_enrollments')
    .update({ monthly_price: normalPrice, discount_applied: false })
    .eq('id', enrollmentId)
}
