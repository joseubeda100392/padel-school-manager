import type { SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_STANDARD_DISCOUNT_CENTS = 4000

// El descuento estándar se aplica sobre la cuota de cada alumno, no sobre el
// precio habitual del grupo: en un mismo grupo puede haber alumnos que pagan
// cuotas distintas (80 €, 85 €…), y a cada uno se le restan los mismos euros.
// Devuelve null si la cuota es menor que el descuento.
export function applyStandardDiscount(monthlyPriceCents: number, discountCents: number): number | null {
  if (monthlyPriceCents < discountCents) return null
  return monthlyPriceCents - discountCents
}

export function removeStandardDiscount(discountedPriceCents: number, discountCents: number): number {
  return discountedPriceCents + discountCents
}

// Descuento pensado como algo puntual (ej. "solo el primer mes"), no una
// rebaja permanente: en cuanto se registra el pago del mes descontado
// (efectivo o Redsys), se resetea aquí para que el mes siguiente vuelva a la
// cuota de siempre de ese alumno — si el admin lo quiere aplicar otra vez,
// marca el check de nuevo.
export async function resetEnrollmentDiscountAfterPayment(
  admin: SupabaseClient,
  enrollmentId: string,
): Promise<void> {
  const { data: enrollment } = await admin
    .from('group_enrollments')
    .select('discount_applied, monthly_price, club_id')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment?.discount_applied) return

  const { data: club } = enrollment.club_id
    ? await admin.from('clubs').select('config').eq('id', enrollment.club_id).single()
    : { data: null }
  const discountCents = (club as any)?.config?.standard_discount_cents ?? DEFAULT_STANDARD_DISCOUNT_CENTS

  await admin
    .from('group_enrollments')
    .update({ monthly_price: removeStandardDiscount(enrollment.monthly_price, discountCents), discount_applied: false })
    .eq('id', enrollmentId)
}
