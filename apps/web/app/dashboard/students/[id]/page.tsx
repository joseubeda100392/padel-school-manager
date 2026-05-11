import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { notFound } from 'next/navigation'
import { formatDate, formatCurrency } from '@/lib/utils'
import { StudentLevelForm } from './student-level-form'
import { BagAdjustForm } from './bag-adjust-form'
import { StudentEditForm } from './student-edit-form'
import { StudentEnrollments } from './student-enrollments'
import { StudentMakeups } from './student-makeups'

const roleLabel: Record<string, string> = {
  student: 'Alumno',
  coach: 'Monitor',
  admin: 'Admin',
}

const statusBadge: Record<string, string> = {
  succeeded: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-500',
}

const statusLabel: Record<string, string> = {
  succeeded: 'Cobrado',
  pending: 'Pendiente',
  failed: 'Fallido',
  refunded: 'Reembolsado',
}

const typeLabel: Record<string, string> = {
  subscription: 'Suscripción',
  pay_per_class: 'Clase suelta',
  bag_pack: 'Bono de clases',
  manual: 'Manual',
}

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const clubId = await getClubId()

  const [
    { data: student, error: studentError },
    { data: levels },
    { data: bag },
    { data: levelHistory },
    { data: bagHistory },
    { data: payments },
    { data: enrollments },
    { data: makeups },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, role, phone, is_active, created_at, current_level_id, club_id, avatar_url, start_date, end_date')
      .eq('id', params.id)
      .single(),
    clubId
      ? supabase.from('levels').select('id, name, color').eq('club_id', clubId).order('order')
      : supabase.from('levels').select('id, name, color').order('order'),
    supabase.from('class_bag').select('balance').eq('user_id', params.id).single(),
    supabase
      .from('user_levels')
      .select('id, created_at, level:levels(name, color), assigned_by')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('bag_transactions')
      .select('id, delta, reason, created_at')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('payments')
      .select('id, amount, type, status, currency, created_at')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('group_enrollments')
      .select('id, monthly_price, paid_until, status, start_date, end_date, schedule:schedules(id, start_time, court:courts(name))')
      .eq('student_id', params.id)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false }),
    supabase
      .from('makeups')
      .select('id, original_date, makeup_date, status, notes, schedule:schedules(id, start_time)')
      .eq('student_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  if (studentError || !student) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-red-700">
        <p className="font-semibold">Error al cargar el alumno</p>
        <p className="text-sm">{studentError?.message ?? 'No encontrado'}</p>
        <a href="/dashboard/students" className="mt-3 block text-sm underline">← Volver</a>
      </div>
    )
  }

  if (clubId && (student as any).club_id && (student as any).club_id !== clubId) notFound()

  const currentLevelId = (student as any).current_level_id as string | null
  const currentLevel = currentLevelId
    ? (levels ?? []).find((l: any) => l.id === currentLevelId) ?? null
    : null

  const totalPagado = (payments ?? [])
    .filter((p: any) => p.status === 'succeeded')
    .reduce((acc: number, p: any) => acc + p.amount, 0)

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <a href="/dashboard/students" className="text-sm text-gray-500 hover:text-gray-700">
          ← Alumnos
        </a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${(student as any).is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {(student as any).is_active ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Info básica */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Información</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Email</dt>
            <dd className="mt-1 break-all text-sm text-gray-900">{student.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Rol</dt>
            <dd className="mt-1 text-sm text-gray-900">{roleLabel[student.role as string] ?? student.role}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Teléfono</dt>
            <dd className="mt-1 text-sm text-gray-900">{(student as any).phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Alta</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate((student as any).start_date ?? student.created_at as string)}</dd>
          </div>
        </dl>
      </div>

      {/* Editar info */}
      <div className="mb-6">
        <StudentEditForm student={{
          id: student.id as string,
          name: student.name as string,
          email: student.email as string,
          phone: (student as any).phone ?? '',
          role: student.role as string,
          is_active: (student as any).is_active ?? true,
          start_date: (student as any).start_date ?? (student.created_at as string).split('T')[0],
          end_date: (student as any).end_date ?? '',
        }} />
      </div>

      {/* Clases y cuotas */}
      <div className="mb-6">
        <StudentEnrollments initialEnrollments={(enrollments ?? []).map((e: any) => ({
          id: e.id,
          monthly_price: e.monthly_price,
          paid_until: e.paid_until,
          start_date: e.start_date,
          end_date: e.end_date,
          schedule: e.schedule ? { id: e.schedule.id, start_time: e.schedule.start_time, court: e.schedule.court } : null,
        }))} />
      </div>

      {/* Nivel + Bolsa */}
      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Nivel de juego</h2>
          {currentLevel && (
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-white"
              style={{ backgroundColor: (currentLevel as any).color }}
            >
              {(currentLevel as any).name}
            </div>
          )}
          <StudentLevelForm
            studentId={student.id as string}
            currentLevelId={(student as any).current_level_id ?? null}
            levels={levels ?? []}
          />
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Clases disponibles</h2>
          <p className="mb-1 text-5xl font-bold text-green-600">{bag?.balance ?? 0}</p>
          <p className="mb-5 text-sm text-gray-500">clases disponibles</p>
          <BagAdjustForm studentId={student.id as string} currentBalance={bag?.balance ?? 0} />

          {bagHistory && bagHistory.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase text-gray-400">Últimos movimientos</p>
              <ul className="space-y-1.5">
                {bagHistory.map((t: any) => (
                  <li key={t.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{t.reason || 'Sin motivo'}</span>
                    <span className={t.delta > 0 ? 'font-medium text-green-600' : 'font-medium text-red-600'}>
                      {t.delta > 0 ? '+' : ''}{t.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Recuperaciones */}
      {makeups && makeups.length > 0 && (
        <div className="mb-6">
          <StudentMakeups initialMakeups={(makeups ?? []).map((m: any) => ({
            id: m.id,
            original_date: m.original_date,
            makeup_date: m.makeup_date,
            status: m.status,
            notes: m.notes,
            schedule: m.schedule ? { id: m.schedule.id, start_time: m.schedule.start_time } : null,
          }))} />
        </div>
      )}

      {/* Historial de pagos */}
      <div className="mb-6 rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Historial de pagos</h2>
          {totalPagado > 0 && (
            <span className="text-sm font-semibold text-green-700">
              Total: {formatCurrency(totalPagado)}
            </span>
          )}
        </div>
        {!payments?.length ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">Sin pagos registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Importe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-700">{typeLabel[p.type] ?? p.type ?? '—'}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900">{formatCurrency(p.amount, p.currency ?? 'EUR')}</td>
                    <td className="px-6 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {statusLabel[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historial de niveles */}
      {levelHistory && levelHistory.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Historial de niveles</h2>
          <ul className="space-y-3">
            {levelHistory.map((entry: any) => (
              <li key={entry.id} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.level?.color }} />
                  <span className="text-sm font-medium text-gray-900">{entry.level?.name}</span>
                  {entry.assigned_by && (
                    <span className="text-xs text-gray-400">asignado</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{formatDate(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
