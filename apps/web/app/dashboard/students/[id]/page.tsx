import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { StudentLevelForm } from './student-level-form'
import { BagAdjustForm } from './bag-adjust-form'

const roleLabel: Record<string, string> = {
  student: 'Alumno',
  coach: 'Monitor',
  admin: 'Admin',
}

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const clubId = await getClubId()

  const [
    { data: student },
    { data: levels },
    { data: bag },
    { data: levelHistory },
    { data: bagHistory },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('*, currentLevel:levels(id, name, color)')
      .eq('id', params.id)
      .single(),
    clubId
      ? supabase.from('levels').select('id, name, color').eq('club_id', clubId).order('order')
      : supabase.from('levels').select('id, name, color').order('order'),
    supabase.from('class_bag').select('balance').eq('user_id', params.id).single(),
    supabase
      .from('user_levels')
      .select('id, created_at, level:levels(name, color), assignedBy:users!user_levels_assigned_by_fkey(name)')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('bag_transactions')
      .select('id, delta, reason, created_at')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (!student) notFound()

  // Verificar que el alumno pertenece al club del admin
  if (clubId && (student as any).club_id && (student as any).club_id !== clubId) notFound()

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <a href="/dashboard/students" className="text-sm text-gray-500 hover:text-gray-700">
          ← Alumnos
        </a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${(student as any).is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {(student as any).is_active ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Información</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{student.email}</dd>
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
            <dd className="mt-1 text-sm text-gray-900">{formatDate(student.created_at as string)}</dd>
          </div>
        </dl>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Nivel de juego</h2>
          {(student as any).currentLevel && (
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-white"
              style={{ backgroundColor: (student as any).currentLevel.color }}
            >
              {(student as any).currentLevel.name}
            </div>
          )}
          <StudentLevelForm
            studentId={student.id as string}
            currentLevelId={(student as any).current_level_id ?? null}
            levels={levels ?? []}
          />
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Bolsa de clases</h2>
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

      {levelHistory && levelHistory.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Historial de niveles</h2>
          <ul className="space-y-3">
            {levelHistory.map((entry: any) => (
              <li key={entry.id} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.level?.color }} />
                  <span className="text-sm font-medium text-gray-900">{entry.level?.name}</span>
                  {entry.assignedBy && (
                    <span className="text-xs text-gray-400">por {entry.assignedBy.name}</span>
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
