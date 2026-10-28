export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { resetEnrollmentDiscountAfterPayment } from '@/lib/enrollment-discount'
import { z } from 'zod'
import { nextPaidUntilForEnrollment } from '@/lib/billing-cycle'
import { IN_CLUB_METHODS } from '@/lib/payment-method'
import { MAX_FEE_MONTHS, billingMonthStr, splitAmount } from '@/lib/fee-months'

const bodySchema = z.object({
  method: z.enum(IN_CLUB_METHODS).default('cash'),
  months: z.number().int().min(1).max(MAX_FEE_MONTHS).default(1),
  // Importe total cobrado si el club lo cambia; si no, la cuota de cada mes.
  amountCents: z.number().int().min(0).max(10_000_000).optional(),
  // paid_until que tenía la pantalla al cobrar: si ya no coincide, alguien
  // cobró antes (otra pestaña, una pantalla sin recargar) y no se cobra dos veces.
  expectedPaidUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: adminUser } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Sin body (llamadas antiguas) cuenta como efectivo, igual que antes.
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Datos del cobro no válidos' }, { status: 400 })
  const { method, months, amountCents, expectedPaidUntil } = parsed.data

  const { data: enrollment, error: enrollmentErr } = await admin
    .from('group_enrollments')
    .select('student_id, monthly_price, club_id, price_per_class_cents, discount_classes_pending, paid_until, start_date')
    .eq('id', params.id)
    .single()

  if (enrollmentErr) return NextResponse.json({ error: 'Error al leer la inscripción: ' + enrollmentErr.message }, { status: 500 })
  if (!enrollment) return NextResponse.json({ error: 'Inscripción no encontrada' }, { status: 404 })

  if (adminUser.role !== 'super_admin' && enrollment.club_id && enrollment.club_id !== adminUser.club_id) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  if (expectedPaidUntil !== undefined && expectedPaidUntil !== enrollment.paid_until) {
    return NextResponse.json({ error: 'Esta cuota ya se había cobrado. Recarga la página para ver cómo está.' }, { status: 409 })
  }

  const coveredUntil: string[] = []
  for (let i = 0; i < months; i++) {
    coveredUntil.push(nextPaidUntilForEnrollment(coveredUntil.at(-1) ?? enrollment.paid_until, enrollment.start_date))
  }
  const paidUntil = coveredUntil.at(-1)!

  const clubId = enrollment.club_id ?? adminUser.club_id

  // Módulo de validación de clases: si hay clases pendientes de descontar
  // (no dadas por causa del club) y precio por clase configurado, se
  // resta del importe habitual en vez de cobrar la cuota fija completa.
  const { data: club } = clubId ? await admin.from('clubs').select('features').eq('id', clubId).single() : { data: null }
  const validationOn = !!(club as any)?.features?.enable_class_validation
  const pendingDiscount = enrollment.discount_classes_pending ?? 0
  const discountCents = validationOn && enrollment.price_per_class_cents && pendingDiscount > 0
    ? pendingDiscount * enrollment.price_per_class_cents
    : 0
  const defaultTotal = Math.max(0, enrollment.monthly_price * months - discountCents)
  const amounts = splitAmount(amountCents ?? defaultTotal, months)
  const amountToCharge = amounts.reduce((a, b) => a + b, 0)

  const enrollmentUpdate: Record<string, unknown> = { paid_until: paidUntil }
  if (discountCents > 0) enrollmentUpdate.discount_classes_pending = 0

  // Solo avanza si nadie ha cobrado entre la lectura y ahora (dos clics a la vez).
  let update = admin.from('group_enrollments').update(enrollmentUpdate).eq('id', params.id)
  update = enrollment.paid_until ? update.eq('paid_until', enrollment.paid_until) : update.is('paid_until', null)
  const { data: updated, error: enrollErr } = await update.select('id')
  if (enrollErr) return NextResponse.json({ error: enrollErr.message }, { status: 500 })
  if (!updated?.length) {
    return NextResponse.json({ error: 'Esta cuota ya se había cobrado. Recarga la página para ver cómo está.' }, { status: 409 })
  }

  const thisMonth = billingMonthStr()
  // Un pago por mes, cada uno con el mes que cubre (así lo leen Pagos,
  // "Mis pagos" y la comprobación semanal de cobros).
  const { error: paymentError } = await admin.from('payments').insert(coveredUntil.map((until, i) => ({
    user_id: enrollment.student_id,
    club_id: clubId,
    amount: amounts[i],
    type: 'fixed_group_month',
    status: 'succeeded',
    metadata: {
      enrollment_id: params.id, method, paid_until: until,
      ...(until.slice(0, 7) > thisMonth ? { advance: true } : {}),
      ...(i === 0 && discountCents > 0 ? { discount_applied_cents: discountCents, discount_classes: pendingDiscount } : {}),
    },
  })))

  if (paymentError) {
    await admin.from('group_enrollments').update({
      paid_until: enrollment.paid_until,
      ...(discountCents > 0 ? { discount_classes_pending: pendingDiscount } : {}),
    }).eq('id', params.id)
    return NextResponse.json({ error: paymentError.message }, { status: 500 })
  }

  // El descuento estándar es puntual, no permanente — se cobra este mes ya
  // con el precio rebajado (amountToCharge de arriba) y se resetea para
  // el siguiente en cuanto este pago queda registrado. Nunca debe tirar
  // abajo la confirmación de un pago ya registrado — si falla, se
  // registra y se sigue.
  try {
    await resetEnrollmentDiscountAfterPayment(admin, params.id)
  } catch (err) {
    console.error('[mark-paid] resetEnrollmentDiscountAfterPayment failed:', err)
  }

  return NextResponse.json({ ok: true, paidUntil, amountCharged: amountToCharge, discountCents })
}
