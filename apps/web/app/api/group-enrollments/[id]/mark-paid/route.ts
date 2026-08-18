export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { resetEnrollmentDiscountAfterPayment } from '@/lib/enrollment-discount'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = getAdminClient()
  const { data: adminUser } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!adminUser || !['admin', 'super_admin'].includes(adminUser.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: enrollment, error: enrollmentErr } = await admin
    .from('group_enrollments')
    .select('student_id, monthly_price, club_id, price_per_class_cents, discount_classes_pending')
    .eq('id', params.id)
    .single()

  if (enrollmentErr) return NextResponse.json({ error: 'Error al leer la inscripción: ' + enrollmentErr.message }, { status: 500 })
  if (!enrollment) return NextResponse.json({ error: 'Inscripción no encontrada' }, { status: 404 })

  if (adminUser.role !== 'super_admin' && enrollment.club_id && enrollment.club_id !== adminUser.club_id) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const now = new Date()
  const paidUntil = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

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
  const amountToCharge = Math.max(0, enrollment.monthly_price - discountCents)

  const enrollmentUpdate: Record<string, unknown> = { paid_until: paidUntil }
  if (discountCents > 0) enrollmentUpdate.discount_classes_pending = 0

  const { error: enrollErr } = await admin.from('group_enrollments').update(enrollmentUpdate).eq('id', params.id)
  if (enrollErr) return NextResponse.json({ error: enrollErr.message }, { status: 500 })

  const { error: paymentError } = await admin.from('payments').insert({
    user_id: enrollment.student_id,
    club_id: clubId,
    amount: amountToCharge,
    type: 'fixed_group_month',
    status: 'succeeded',
    metadata: {
      enrollment_id: params.id, method: 'cash', paid_until: paidUntil,
      ...(discountCents > 0 ? { discount_applied_cents: discountCents, discount_classes: pendingDiscount } : {}),
    },
  })

  if (paymentError) {
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
