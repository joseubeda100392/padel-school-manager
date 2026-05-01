import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

const roleLabel: Record<string, string> = {
  student: 'Alumno',
  coach: 'Monitor',
  admin: 'Admin',
}

const roleBadge: Record<string, string> = {
  student: 'bg-blue-100 text-blue-700',
  coach: 'bg-purple-100 text-purple-700',
  admin: 'bg-green-100 text-green-700',
}

export default async function StudentsPage() {
  const supabase = createClient()

  const [{ data: students, error }, { data: levels }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, role, is_active, created_at, current_level_id')
      .order('created_at', { ascending: false }),
    supabase.from('levels').select('id, name, color'),
  ])

  const levelMap = Object.fromEntries((levels ?? []).map((l: any) => [l.id, l]))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500">{students?.length ?? 0} usuarios registrados</p>
          {error && (
            <p className="mt-1 text-xs text-red-500">Error: {error.message}</p>
          )}
        </div>
        <a
          href="/dashboard/students/new"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          + Nuevo usuario
        </a>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Nivel</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Alta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!students?.length && !error && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No hay usuarios aún. Crea el primero.
                </td>
              </tr>
            )}
            {students?.map((s: any) => {
              const level = s.current_level_id ? levelMap[s.current_level_id] : null
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <a href={`/dashboard/students/${s.id}`} className="font-medium text-gray-900 hover:text-green-600">
                      {s.name}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{s.email}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${roleBadge[s.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {roleLabel[s.role] ?? s.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {level ? (
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                        style={{ backgroundColor: level.color }}
                      >
                        {level.name}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(s.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
