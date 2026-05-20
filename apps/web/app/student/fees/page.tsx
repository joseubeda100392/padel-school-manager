import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatCurrency, formatTime, getDayOfWeek } from '@/lib/utils'
import { PayButton } from '@/components/pay-button'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function isPaidThisMonth(paidUntil: string | null) {
  if (!paidUntil) return false
  const now = new Date()
  return new Date(paidUntil) >= new Date(now.getFullYear(), now.getMonth() + 1, 0)
}

export default async function StudentFeesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const currentMonthStr = MONTHS[now.getMonth()]
  const currentYear = now.getFullYear()

  const [{ data: enrollments }, { data: paymentsRaw }] = await Promise.all([
    getAdminClient()
      .from('group_enrollments')
      .select(`
        id, monthly_price, paid_until, enrolled_at,
        schedule:schedules(
          id, start_time, end_time,
          court:courts(name),
          level:levels(name, color)
        )
      `)
      .eq('student_id', user.id)
      .eq('status', 'active')
      .order('enrolled_at'),
    getAdminClient()
      .from('payments')
      .select('id, amount, type, status, created_at, metadata')
      .eq('user_id', user.id)
      .eq('type', 'fixed_group_month')
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const totalMonthly = (enrollments ?? []).reduce((s, e) => s + e.monthly_price, 0)
  const pendingCount = (enrollments ?? []).filter(e => !isPaidThisMonth(e.paid_until)).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: '#0b1c30' }}>Mis Cuotas</h1>
          <p className="text-[13px] mt-0.5" style={{ color: '#3e4a3d' }}>
            Gestiona y paga tus cuotas mensuales de grupo fijo.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold"
            style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
            {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', border: '1px solid #bdcaba' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#3e4a3d' }}>Clases activas</p>
          <p className="text-[28px] font-extrabold leading-none" style={{ color: '#0b1c30' }}>{(enrollments ?? []).length}</p>
          <p className="text-[11px] mt-1" style={{ color: '#bdcaba' }}>inscripciones</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', border: '1px solid #bdcaba' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#3e4a3d' }}>Total mensual</p>
          <p className="text-[28px] font-extrabold leading-none" style={{ color: '#006b2c' }}>{formatCurrency(totalMonthly)}</p>
          <p className="text-[11px] mt-1" style={{ color: '#bdcaba' }}>/ mes</p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-2xl p-4" style={{
          background: pendingCount > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(0,107,44,0.06)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${pendingCount > 0 ? 'rgba(220,38,38,0.2)' : 'rgba(0,107,44,0.2)'}`,
        }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#3e4a3d' }}>Estado {currentMonthStr}</p>
          <p className="text-[28px] font-extrabold leading-none" style={{ color: pendingCount > 0 ? '#dc2626' : '#006b2c' }}>
            {pendingCount > 0 ? 'Pendiente' : 'Al día'}
          </p>
          <p className="text-[11px] mt-1" style={{ color: pendingCount > 0 ? '#dc2626' : '#006b2c', opacity: 0.7 }}>
            {currentMonthStr} {currentYear}
          </p>
        </div>
      </div>

      {/* Enrollment fee cards */}
      <div>
        <h2 className="text-[15px] font-extrabold mb-3" style={{ color: '#0b1c30' }}>
          Cuota de {currentMonthStr} {currentYear}
        </h2>

        {(enrollments ?? []).length === 0 ? (
          <div className="rounded-2xl border p-10 text-center" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', borderColor: '#bdcaba' }}>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: '#eff4ff' }}>
              <svg className="h-6 w-6" style={{ color: '#bdcaba' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <p className="text-[13px] font-semibold" style={{ color: '#3e4a3d' }}>No tienes clases activas.</p>
            <p className="mt-1 text-[12px]" style={{ color: '#bdcaba' }}>Habla con tu administrador para inscribirte.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(enrollments ?? []).map(e => {
              const schedule = e.schedule as any
              const isPaid = isPaidThisMonth(e.paid_until)
              const startDt = schedule?.start_time ? new Date(schedule.start_time) : null
              const endDt = schedule?.end_time ? new Date(schedule.end_time) : null
              const dayLabel = startDt ? DAYS[getDayOfWeek(startDt)] : '—'
              const startTime = startDt ? formatTime(startDt) : '—'
              const endTime = endDt ? formatTime(endDt) : '—'
              const courtName = schedule?.court?.name ?? '—'
              const level = schedule?.level ?? null
              const paidUntilLabel = e.paid_until
                ? new Date(e.paid_until + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                : null

              return (
                <div
                  key={e.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${isPaid ? 'rgba(0,107,44,0.2)' : '#bdcaba'}`,
                    borderLeft: `4px solid ${isPaid ? '#006b2c' : '#dc2626'}`,
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-extrabold" style={{ color: '#0b1c30' }}>
                          {dayLabel} · {startTime} – {endTime}
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: '#3e4a3d' }}>{courtName}</p>
                        {level && (
                          <span
                            className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: level.color }}
                          >
                            {level.name}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[18px] font-extrabold" style={{ color: '#0b1c30' }}>
                          {formatCurrency(e.monthly_price)}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: '#bdcaba' }}>/mes</span>
                        </p>
                        <span
                          className="mt-1 inline-block rounded-xl px-2.5 py-1 text-[11px] font-bold"
                          style={isPaid
                            ? { background: 'rgba(0,107,44,0.1)', color: '#006b2c' }
                            : { background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}
                        >
                          {isPaid ? '✓ Pagado' : 'Pendiente'}
                        </span>
                      </div>
                    </div>

                    {isPaid && paidUntilLabel && (
                      <p className="mt-2 text-[11px]" style={{ color: '#006b2c', opacity: 0.8 }}>
                        Pagado hasta {paidUntilLabel}
                      </p>
                    )}

                    {!isPaid && (
                      <div className="mt-3">
                        <PayButton
                          type="fixed_group_month"
                          enrollmentId={e.id}
                          label={`Pagar ${formatCurrency(e.monthly_price)} — ${currentMonthStr}`}
                          className="w-full rounded-xl py-3 text-[13px] font-bold text-white disabled:opacity-50 transition-opacity hover:opacity-90 bg-[#006b2c]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Payment history */}
      {(paymentsRaw ?? []).length > 0 && (
        <div>
          <h2 className="text-[15px] font-extrabold mb-3" style={{ color: '#0b1c30' }}>Historial de pagos</h2>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', border: '1px solid #bdcaba' }}>
            <div className="divide-y" style={{ borderColor: '#bdcaba' }}>
              {(paymentsRaw ?? []).map((p, idx) => {
                const date = new Date(p.created_at)
                const dateLabel = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                const meta = p.metadata as any
                const paidUntil = meta?.paid_until
                  ? new Date(meta.paid_until + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                  : null
                const isSucceeded = p.status === 'succeeded'

                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: isSucceeded ? 'rgba(0,107,44,0.08)' : 'rgba(220,38,38,0.08)' }}
                      >
                        {isSucceeded ? (
                          <svg className="h-4 w-4" style={{ color: '#006b2c' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" style={{ color: '#dc2626' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold" style={{ color: '#0b1c30' }}>
                          {paidUntil ? `Cuota ${paidUntil}` : 'Cuota mensual'}
                        </p>
                        <p className="text-[11px]" style={{ color: '#bdcaba' }}>{dateLabel}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-extrabold" style={{ color: isSucceeded ? '#006b2c' : '#dc2626' }}>
                        {formatCurrency(p.amount)}
                      </p>
                      <p className="text-[10px]" style={{ color: '#bdcaba' }}>
                        {meta?.method === 'cash' ? 'Efectivo' : 'Redsys'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
