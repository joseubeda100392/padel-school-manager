import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { getClubFeatures } from '@/lib/get-club-features'

export default async function CoachMaterialsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await getAdminClient()
    .from('users')
    .select('club_id')
    .eq('id', user.id)
    .single()

  const features = await getClubFeatures(profile?.club_id)
  if (!features.enable_materials) redirect('/coach')

  const query = supabase
    .from('materials')
    .select('*, material_levels(level:levels(name, color))')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  const { data: materials } = await (
    profile?.club_id ? query.eq('club_id', profile.club_id) : query
  )

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Material didáctico</h1>
        <p className="text-sm text-gray-500">{materials?.length ?? 0} documentos</p>
      </div>

      {materials?.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <p className="text-gray-400">No hay materiales publicados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {materials?.map((m: any) => (
            <div key={m.id} className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <span className="text-sm font-bold text-red-600">PDF</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{m.title}</p>
                {m.description && (
                  <p className="mt-0.5 text-sm text-gray-500 truncate">{m.description}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.material_levels?.map((ml: any, i: number) => (
                    <span
                      key={i}
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: ml.level?.color ?? '#6b7280' }}
                    >
                      {ml.level?.name}
                    </span>
                  ))}
                  {(!m.material_levels || m.material_levels.length === 0) && (
                    <span className="text-xs text-gray-400">Todos los niveles</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <p className="text-xs text-gray-400">{formatDate(m.created_at)}</p>
                {m.file_url && (
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Abrir
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
