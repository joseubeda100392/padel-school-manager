import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getClubFeatures } from '@/lib/get-club-features'

export default async function CoachNormasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const clubId = profile?.club_id ?? null

  const features = await getClubFeatures(clubId)
  const pdfUrl = features.terms_pdf_url

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Normas y condiciones</h1>
        <p className="text-sm text-gray-500">Condiciones de uso de la escuela</p>
      </div>

      {pdfUrl ? (
        <div className="rounded-xl bg-white p-8 shadow-sm text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <span className="text-3xl">📄</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">Condiciones de uso</p>
            <p className="mt-1 text-sm text-gray-500">Pulsa el botón para ver el documento</p>
          </div>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Ver PDF
          </a>
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
