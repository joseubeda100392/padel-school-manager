import type { SupabaseClient } from '@supabase/supabase-js'

// Importe fijo que se restaba antes de pasar al descuento del 50%. Solo se
// usa para quitar descuentos aplicados antes de ese cambio, que no tienen
// guardado group_enrollments.discount_cents.
export const DEFAULT_STANDARD_DISCOUNT_CENTS = 4000

// El descuento es la mitad de la cuota de cada alumno (no la del grupo: en un
// mismo grupo puede haber cuotas distintas). Con céntimos impares, el
// céntimo sobrante lo paga el alumno.
export function halfFeeDiscountCents(monthlyPriceCents: number): number {
  return Math.floor(monthlyPriceCents / 2)
}

// Se devuelve exactamente lo que se descontó, guardado al aplicarlo — así la
// cuota vuelve a su importe original aunque la regla de descuento cambie.
export function restoreDiscountedPrice(
  discountedPriceCents: number,
  appliedDiscountCents: number | null | undefined,
  legacyDiscountCents: number,
): number {
  return discountedPriceCents + (appliedDiscountCents ?? legacyDiscountCents)
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
    .select('discount_applied, discount_cents, monthly_price, club_id')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment?.discount_applied) return

  let legacyDiscountCents = DEFAULT_STANDARD_DISCOUNT_CENTS
  if (enrollment.discount_cents == null && enrollment.club_id) {
    const { data: club } = await admin.from('clubs').select('config').eq('id', enrollment.club_id).single()
    legacyDiscountCents = (club as any)?.config?.standard_discount_cents ?? DEFAULT_STANDARD_DISCOUNT_CENTS
  }

  await admin
    .from('group_enrollments')
    .update({
      monthly_price: restoreDiscountedPrice(enrollment.monthly_price, enrollment.discount_cents, legacyDiscountCents),
      discount_applied: false,
      discount_cents: null,
    })
    .eq('id', enrollmentId)
}
