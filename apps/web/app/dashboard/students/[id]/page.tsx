export const dynamic = 'force-dynamic'

import { getAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { notFound } from 'next/navigation'
import { formatDate, formatCurrency } from '@/lib/utils'
import { DEFAULT_STANDARD_DISCOUNT_CENTS } from '@/lib/enrollment-discount'
import { StudentLevelForm } from './student-level-form'
import { BagAdjustForm } from './bag-adjust-form'
import { BagHistoryList } from './bag-history-list'
import { StudentEditForm } from './student-edit-form'
import { StudentEnrollments } from './student-enrollments'
import { CausarBajaButton } from './causar-baja-button'
import { StudentMakeups } from './student-makeups'
import { NotificationList } from '@/app/student/notifications/notification-list'
import { StudentObjectives } from './student-objectives'
import { ResetMfaButton } from './reset-mfa-button'
import { StudentMandate } from './student-mandate'
import { DevError } from '@/components/dev-error'
import { PAYMENT_METHODS, paymentMethodKey } from '@/lib/payment-method'
import { CircleAlert, CircleCheck, CircleOff, Clock, Receipt, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { EmptyState, Notice } from '@/components/ui/feedback'
import { Avatar, List, ListRow, Stat } from '@/components/ui/list'

const roleLabel: Record<string, string> = {
  student: 'Alumno',
  coach: 'Monitor',
  admin: 'Admin',
}

const statusBadge: Record<string, { tone: 'success' | 'warn' | 'danger' | 'neutral'; Icon: typeof CircleCheck }> = {
  succeeded: { tone: 'success', Icon: CircleCheck },
  pending: { tone: 'warn', Icon: Clock },
  failed: { tone: 'danger', Icon: CircleAlert },
  refunded: { tone: 'neutral', Icon: Undo2 },
}

const statusLabel: Record<string, string> = {
  succeeded: 'Cobrado',
  pending: 'Pendiente',
  failed: 'Fallido',
  refunded: 'Reembolsado',
}

const typeLabel: Record<string, string> = {
  fixed_group_month: 'Cuota mensual',
  single_class:      'Clase suelta',
  class_pack:        'Bono de clases',
  tournament:        'Inscripción torneo',
  intensivo_group:   'Semana intensiva',
  manual:            'Manual',
  subscription:      'Suscripción',
  pay_per_class:     'Clase suelta',
  bag_pack:          'Bono de clases',
  mandate_init:      'Activación domiciliación',
  mandate_charge:    'Cuota mensual (domiciliada)',
}

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const admin = getAdminClient()
  const supabase = createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  const viewerRole = currentUser?.user_metadata?.role ?? ''
  const clubId = await getClubId()

  const [
    { data: student, error: studentError },
    { data: levels },
    { data: bag },
    { data: levelHistory },
    { data: bagHistory },
    { data: payments },
    { data: enrollments },
    { data: makeups, error: makeupsError },
    { data: studentNotifications },
    { data: checklists },
    features,
    { data: clubRow },
    { data: otherStudents },
  ] = await Promise.all([
    admin
      .from('users')
      .select('id, name, email, role, phone, is_active, created_at, current_level_id, club_id, avatar_url, start_date, end_date, also_student, is_external, is_premium_private_coach')
      .eq('id', params.id)
      .single(),
    clubId
      ? admin.from('levels').select('id, name, color').eq('club_id', clubId).order('order')
      : admin.from('levels').select('id, name, color').order('order'),
    admin.from('class_bag').select('balance_60, balance_90').eq('user_id', params.id).single(),
    admin
      .from('user_levels')
      .select('id, created_at, level:levels(name, color), assigned_by')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('bag_transactions')
      .select('id, delta, reason, created_at')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('payments')
      .select('id, amount, type, status, currency, created_at, metadata, redsys_order_id, stripe_payment_intent_id')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('group_enrollments')
      .select('id, monthly_price, paid_until, status, start_date, end_date, discount_applied, discount_cents, schedule:schedules(id, start_time, court:courts(name))')
      .eq('student_id', params.id)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false }),
    admin
      .from('makeups')
      .select('id, original_date, makeup_date, status, notes, schedule:schedules!makeups_original_schedule_id_fkey(id, start_time)')
      .eq('student_id', params.id)
      .order('created_at', { ascending: false }),
    admin
      .from('notifications')
      .select('id, type, title, body, data, is_read, created_at')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('student_checklists')
      .select('id, title, created_at, completed_at, items:checklist_items(id, text, sort_order, completed_at, completed_by_id)')
      .eq('student_id', params.id)
      .order('created_at', { ascending: false }),
    getClubFeatures(clubId ?? undefined),
    clubId
      ? admin.from('clubs').select('config').eq('id', clubId).single()
      : Promise.resolve({ data: null }),
    (clubId
      ? admin.from('users').select('id, name, email').eq('role', 'student').eq('is_active', true).neq('id', params.id).eq('club_id', clubId).order('name')
      : admin.from('users').select('id, name, email').eq('role', 'student').eq('is_active', true).neq('id', params.id).order('name')),
  ])

  if (studentError || !student) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <PageHeader title="Ficha del usuario" back={{ href: '/dashboard/students', label: 'Usuarios' }} />
        <Notice tone="danger" icon={<CircleAlert />}>
          <p className="font-medium">No se ha podido cargar el usuario</p>
          <p className="text-meta">{studentError?.message ?? 'No encontrado'}</p>
        </Notice>
      </div>
    )
  }

  if (clubId && (student as any).club_id && (student as any).club_id !== clubId) notFound()

  if (makeupsError) console.error('[students/[id]] makeups query failed:', makeupsError.message)

  // Un monitor marcado como also_student usa las secciones de alumno
  // (cuota, bolsa, nivel...) igual que un alumno normal, sin que su role
  // en users deje de ser 'coach' para el resto del sistema (paneles, etc.).
  const actsAsStudent = student.role === 'student' || (student.role === 'coach' && (student as any).also_student === true)
  const currentLevelId = (student as any).current_level_id as string | null
  const currentLevel = currentLevelId
    ? (levels ?? []).find((l: any) => l.id === currentLevelId) ?? null
    : null

  const totalPagado = (payments ?? [])
    .filter((p: any) => p.status === 'succeeded')
    .reduce((acc: number, p: any) => acc + p.amount, 0)

  const legacyDiscountCents = (clubRow as any)?.config?.standard_discount_cents ?? DEFAULT_STANDARD_DISCOUNT_CENTS
  const pendingBajaDate = (enrollments ?? []).find((e: any) => e.end_date)?.end_date ?? null

  const isActive = (student as any).is_active
  const phone = (student as any).phone

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <DevError errors={[makeupsError?.message]} />
      <PageHeader title="Ficha del usuario" back={{ href: '/dashboard/students', label: 'Usuarios' }} />

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={student.name as string} className="h-16 w-16 shrink-0 text-heading" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-title text-ink">{student.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {currentLevel && actsAsStudent && (
                  <LevelTag name={(currentLevel as any).name} color={(currentLevel as any).color} />
                )}
                {isActive ? (
                  <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Activo</Badge>
                ) : (
                  <Badge tone="neutral"><CircleOff className="h-3.5 w-3.5" aria-hidden />Inactivo</Badge>
                )}
              </div>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-meta text-ink-3">Email</dt>
              <dd className="mt-0.5 break-all text-body text-ink">{student.email}</dd>
            </div>
            <div>
              <dt className="text-meta text-ink-3">Rol</dt>
              <dd className="mt-0.5 text-body text-ink">{roleLabel[student.role as string] ?? student.role}</dd>
            </div>
            <div>
              <dt className="text-meta text-ink-3">Teléfono</dt>
              <dd className="mt-0.5 text-body tabular-nums text-ink">{phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-meta text-ink-3">Alta</dt>
              <dd className="mt-0.5 text-body tabular-nums text-ink">{formatDate((student as any).start_date ?? student.created_at as string)}</dd>
            </div>
          </dl>
          {viewerRole === 'super_admin' && ['admin', 'super_admin'].includes((student as any).role) && (
            <div className="mt-5 border-t border-line pt-5">
              <p className="mb-2 text-label text-ink-2">Seguridad</p>
              <ResetMfaButton userId={student.id as string} />
            </div>
          )}
        </CardBody>
      </Card>

      <StudentEditForm student={{
        id: student.id as string,
        name: student.name as string,
        email: student.email as string,
        phone: (student as any).phone ?? '',
        role: student.role as string,
        is_active: (student as any).is_active ?? true,
        start_date: (student as any).start_date ?? (student.created_at as string).split('T')[0],
        end_date: (student as any).end_date ?? '',
        also_student: (student as any).also_student ?? false,
        is_external: (student as any).is_external ?? false,
        is_premium_private_coach: (student as any).is_premium_private_coach ?? false,
      }} isSuperAdmin={viewerRole === 'super_admin'} enablePrivateLessons={features.enable_private_lessons} />

      {actsAsStudent && (student as any).role === 'student' && (
        <div className="flex sm:justify-end">
          <CausarBajaButton
            studentId={student.id as string}
            hasFixedEnrollments={(enrollments ?? []).length > 0}
            pendingBajaDate={pendingBajaDate}
            availableStudents={(otherStudents ?? []).map((s: any) => ({ id: s.id, name: s.name, email: s.email }))}
          />
        </div>
      )}

      {actsAsStudent && (
        <StudentEnrollments initialEnrollments={(enrollments ?? []).map((e: any) => ({
          id: e.id,
          monthly_price: e.monthly_price,
          paid_until: e.paid_until,
          start_date: e.start_date,
          end_date: e.end_date,
          discount_applied: e.discount_applied ?? false,
          discount_cents: e.discount_cents ?? null,
          schedule: e.schedule ? { id: e.schedule.id, start_time: e.schedule.start_time, court: e.schedule.court } : null,
        }))} legacyDiscountCents={legacyDiscountCents} />
      )}

      {actsAsStudent && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader title="Nivel de juego" />
            <CardBody className="space-y-4">
              {currentLevel && <LevelTag name={(currentLevel as any).name} color={(currentLevel as any).color} className="text-label" />}
              <StudentLevelForm
                studentId={student.id as string}
                currentLevelId={(student as any).current_level_id ?? null}
                levels={levels ?? []}
              />
            </CardBody>
          </Card>

          {features.enable_bag && (
            <Card>
              <CardHeader title="Clases disponibles" />
              <CardBody className="space-y-4">
                <div className="flex gap-8">
                  {features.enable_60min && (
                    <Stat label="60 min" value={bag?.balance_60 ?? 0} />
                  )}
                  {features.enable_90min && (
                    <Stat label="90 min" value={bag?.balance_90 ?? 0} />
                  )}
                </div>
                <BagAdjustForm studentId={student.id as string} balance60={bag?.balance_60 ?? 0} balance90={bag?.balance_90 ?? 0} />

                <BagHistoryList
                  initial={(bagHistory ?? []).map((t: any) => ({ id: t.id, delta: t.delta, reason: t.reason }))}
                  canDelete={viewerRole === 'super_admin'}
                />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {actsAsStudent && makeups && makeups.length > 0 && (
        <StudentMakeups initialMakeups={(makeups ?? []).map((m: any) => ({
          id: m.id,
          original_date: m.original_date,
          makeup_date: m.makeup_date,
          status: m.status,
          notes: m.notes,
          schedule: m.schedule ? { id: m.schedule.id, start_time: m.schedule.start_time } : null,
        }))} />
      )}

      {features.enable_payments && actsAsStudent && <StudentMandate studentId={student.id as string} />}

      {features.enable_payments && actsAsStudent && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Historial de pagos"
            action={
              totalPagado > 0 ? (
                <span className="text-label tabular-nums text-accent-ink">Total cobrado: {formatCurrency(totalPagado)}</span>
              ) : undefined
            }
          />
          {!payments?.length ? (
            <EmptyState icon={<Receipt />} title="Sin pagos registrados" description="Cuando este usuario pague algo, aparecerá aquí." />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="bg-surface-2 text-left text-meta font-medium text-ink-3">
                    <th scope="col" className="px-4 py-3 sm:px-5">Tipo</th>
                    <th scope="col" className="px-4 py-3">Método</th>
                    <th scope="col" className="px-4 py-3 text-right">Importe</th>
                    <th scope="col" className="px-4 py-3">Estado</th>
                    <th scope="col" className="px-4 py-3 sm:px-5">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {payments.map((p: any) => {
                    const st = statusBadge[p.status] ?? { tone: 'neutral' as const, Icon: CircleOff }
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-3 text-body text-ink sm:px-5">{typeLabel[p.type] ?? p.type ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Badge tone="outline">{PAYMENT_METHODS[paymentMethodKey(p)].label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-label tabular-nums text-ink">{formatCurrency(p.amount, p.currency ?? 'EUR')}</td>
                        <td className="px-4 py-3">
                          <Badge tone={st.tone}><st.Icon className="h-3.5 w-3.5" aria-hidden />{statusLabel[p.status] ?? p.status}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-body tabular-nums text-ink-2 sm:px-5">{formatDate(p.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {actsAsStudent && (
        <Card>
          <CardHeader title="Notificaciones del alumno" />
          <CardBody>
            {(!studentNotifications || studentNotifications.length === 0) ? (
              <p className="text-body text-ink-3">Sin notificaciones.</p>
            ) : (
              <NotificationList initial={studentNotifications as any} targetUserId={params.id} />
            )}
          </CardBody>
        </Card>
      )}

      {actsAsStudent && levelHistory && levelHistory.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Historial de niveles" />
          <List className="mt-2">
            {levelHistory.map((entry: any) => (
              <ListRow
                key={entry.id}
                title={<LevelTag name={entry.level?.name ?? ''} color={entry.level?.color} className="text-[0.9375rem] text-ink" />}
                subtitle={entry.assigned_by ? 'Asignado por un monitor o admin' : undefined}
                trailing={<span className="text-meta tabular-nums text-ink-3">{formatDate(entry.created_at)}</span>}
              />
            ))}
          </List>
        </Card>
      )}

      {features.enable_objectives && actsAsStudent && <StudentObjectives
        studentId={params.id}
        initialChecklists={(checklists ?? []).map((c: any) => ({
          id: c.id,
          title: c.title,
          created_at: c.created_at,
          completed_at: c.completed_at,
          items: (c.items ?? []).map((it: any) => ({
            id: it.id,
            text: it.text,
            sort_order: it.sort_order,
            completed_at: it.completed_at,
            completed_by_id: it.completed_by_id,
          })),
        }))}
      />}
    </div>
  )
}
