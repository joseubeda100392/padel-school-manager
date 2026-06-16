export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { formatDate } from '@/lib/utils'
import { DevError } from '@/components/dev-error'

export default async function MaterialsPage() {
  const supabase = createClient()
  const clubId = await getClubId()

  const query = supabase
    .from('materials')
    .select('*, material_levels(level:levels(name, color))')
    .order('created_at', { ascending: false })

  const { data: materials, error: errMaterials } = await (clubId ? query.eq('club_id', clubId) : query)

  return (
    <div>
      <DevError errors={[errMaterials?.message]} />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Materiales didácticos</h1>
          <p className="text-sm text-gray-500">{materials?.length ?? 0} documentos</p>
        </div>
        <a
          href="/dashboard/materials/new"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          + Subir material
        </a>
      </div>

      <div className="space-y-3">
        {materials?.length === 0 && (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <p className="text-gray-400">No hay materiales. Sube el primero.</p>
            <a href="/dashboard/materials/new" className="mt-3 inline-block text-sm font-medium text-brand-500 hover:underline">
              Subir PDF
            </a>
          </div>
        )}

        {materials?.map((m: any) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
                <span className="text-sm font-bold text-red-600">PDF</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{m.title}</p>
                {m.description && (
                  <p className="mt-0.5 text-sm text-gray-500">{m.description}</p>
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
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-xs text-gray-400">{formatDate(m.created_at)}</p>
                <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${m.is_published ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500'}`}>
                  {m.is_published ? 'Publicado' : 'Borrador'}
                </span>
              </div>
              {m.file_url && (
                <a
                  href={m.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Abrir
                </a>
              )}
              <a
                href={`/dashboard/materials/${m.id}/edit`}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Editar
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
