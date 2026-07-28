import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubFeatures } from '@/lib/get-club-features'

function extractPath(url: string): string | null {
  const match = url.match(/\/object\/(?:public|sign)\/materials\/(.+)/)
  if (match) return match[1].split('?')[0]
  if (url && !url.startsWith('http')) return url
  return null
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = getAdminClient()
  const { data: profile } = await admin.from('users').select('role, club_id').eq('id', user.id).single()
  if (!profile) return new Response('Unauthorized', { status: 401 })

  const cookieStore = cookies()
  const clubId = profile.role === 'super_admin'
    ? (cookieStore.get('sa_active_club')?.value ?? profile.club_id)
    : profile.club_id

  const features = await getClubFeatures(clubId)
  const pdfUrl = features.terms_pdf_url
  if (!pdfUrl) return new Response('Not found', { status: 404 })

  const path = extractPath(pdfUrl)
  if (!path) return new Response('URL inválida', { status: 500 })

  const { data, error } = await admin.storage.from('materials').download(path)
  if (error || !data) return new Response('PDF no disponible', { status: 502 })

  const buffer = await data.arrayBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="normas.pdf"',
    },
  })
}
