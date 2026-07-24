import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getClubFeatures } from '@/lib/get-club-features'

export default async function StudentNormasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const clubId = (profile as any)?.club_id ?? null

  const features = await getClubFeatures(clubId)
  const pdfUrl = features.terms_pdf_url

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Normas y condiciones</h1>
        <p className="text-sm text-gray-500">Condiciones de uso de la escuela</p>
      </div>

      {pdfUrl ? (
        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <p className="text-sm font-medium text-gray-700">Documento de condiciones</p>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Abrir en nueva pestaña
            </a>
          </div>
          <iframe
            src={pdfUrl}
            className="h-[70vh] w-full border-0"
            title="Condiciones de uso"
          />
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 p-8 text-center">
          <p className="text-2xl">📄</p>
          <p className="mt-2 text-sm text-gray-500">
            No hay condiciones disponibles todavía.
          </p>
        </div>
      )}
    </div>
  )
}
