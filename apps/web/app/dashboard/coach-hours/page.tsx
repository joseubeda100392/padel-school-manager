export const dynamic = 'force-dynamic'

import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { redirect } from 'next/navigation'
import { calculateCoachScheduledMonthlyHours } from '@/lib/coach-payroll'
import { MonthNavigator } from '../payments/month-navigator'

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default async function CoachHoursPage({ searchParams }: { searchParams: { month?: string } }) {
  const admin = getAdminClient()
  const clubId = await getClubId()
  const features = await getClubFeatures(clubId ?? undefined)

  // El módulo de validación de clases ya trae su propio contador de horas
  // (más preciso, basado en lo que marca cada monitor) en esa misma
  // pantalla — para no duplicar, esta vista solo existe para clubes que
  // no lo tienen activado.
  if (features.enable_class_validation) redirect('/dashboard/class-validation')

  // Este contador es de horas ya trabajadas (no de facturación), así que el
  // límite para "Siguiente" es el mes de calendario real de hoy, no el mes
  // de facturación efectivo — no tiene sentido "adelantar" a un mes que
  // todavía no ha pasado.
  const todayMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())
  const [todayYear, todayMonth0] = [Number(todayMadrid.slice(0, 4)), Number(todayMadrid.slice(5, 7)) - 1]
  const parsedDate = searchParams.month ? new Date(searchParams.month + '-01') : null
  const selectedYear = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getFullYear() : todayYear
  const selectedMonth0 = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getMonth() : todayMonth0

  const { data: coaches } = clubId
    ? await admin.from('users').select('id, name, email').eq('club_id', clubId).eq('role', 'coach').eq('is_active', true).order('name')
    : { data: [] }

  const hours = await Promise.all(
    (coaches ?? []).map(async (coach) => {
      const monthly = await calculateCoachScheduledMonthlyHours(admin, coach.id, clubId ?? '', { year: selectedYear, month0: selectedMonth0 })
      return { id: coach.id, name: coach.name, email: coach.email, ...monthly }
    })
  )

  const monthLabel = MONTH_NAMES[selectedMonth0]
  const totalHours = hours.reduce((acc, c) => acc + c.hours, 0)
  const totalSessions = hours.reduce((acc, c) => acc + c.sessionCount, 0)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Horas de monitores</h1>
          <p className="text-sm text-gray-500">Calculadas automáticamente a partir del horario fijo de cada uno — sin que tengan que marcar nada.</p>
        </div>
        <MonthNavigator year={selectedYear} month={selectedMonth0} basePath="/dashboard/coach-hours" maxYear={todayYear} maxMonth={todayMonth0} />
      </div>

      <div className="mb-6 rounded-xl border-l-4 border-l-brand-500 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">Total del club en {monthLabel}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}h</p>
        <p className="mt-0.5 text-xs text-gray-400">{totalSessions} clase{totalSessions !== 1 ? 's' : ''} entre {hours.length} monitor{hours.length !== 1 ? 'es' : ''}</p>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Horas en {monthLabel}</h2>
          <p className="mt-0.5 text-xs text-gray-400">Se reinicia solo al empezar cada mes.</p>
        </div>
        {hours.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">No hay monitores en este club.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {hours.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">{c.hours.toFixed(1)}h</p>
                  <p className="text-xs text-gray-400">{c.sessionCount} clase{c.sessionCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
