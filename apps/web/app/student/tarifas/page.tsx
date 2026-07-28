import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export default async function StudentTarifasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const clubId = (profile as any)?.club_id ?? null

  const { data: featRow } = clubId
    ? await admin.from('clubs').select('club_features').eq('id', clubId).single()
    : { data: null }

  const features = (featRow as any)?.club_features ?? {}
  const docs = [
    { key: 'tarifas_pdf_url', label: 'Tarifas', description: 'Precios de clases y bonos', apiPath: '/api/pdf/tarifas' },
    { key: 'calendario_pdf_url', label: 'Calendario', description: 'Calendario de la temporada', apiPath: '/api/pdf/calendario' },
    { key: 'terms_pdf_url', label: 'Normas', description: 'Normas y condiciones de uso', apiPath: '/api/pdf/normas' },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tarifas y documentos</h1>
        <p className="text-sm text-gray-500">Documentos del club disponibles para consultar</p>
      </div>

      <div className="space-y-4">
        {docs.map(doc => {
          const hasUrl = typeof features[doc.key] === 'string' && !!features[doc.key]
          return (
            <div key={doc.key} className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{doc.label}</h2>
                  <p className="mt-0.5 text-xs text-gray-400">{doc.description}</p>
                </div>
                {hasUrl && (
                  <a
                    href={doc.apiPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                  >
                    Ver PDF
                  </a>
                )}
              </div>
              {!hasUrl && (
                <div className="mt-4 flex h-16 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-400">No disponible todavía</p>
                </div>
              )}
              {hasUrl && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
                  <span className="text-xl">📄</span>
                  <p className="text-sm font-medium text-green-700">PDF disponible</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
