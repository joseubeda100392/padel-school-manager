import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

function extractPath(url: string): string | null {
  const match = url.match(/\/object\/(?:public|sign)\/materials\/(.+)/)
  return match ? match[1].split('?')[0] : null
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = getAdminClient()

  const [profileRes, materialRes] = await Promise.all([
    admin.from('users').select('club_id').eq('id', user.id).single(),
    admin.from('materials').select('file_url, club_id, is_published').eq('id', params.id).single(),
  ])

  const userClubId = (profileRes.data as any)?.club_id
  const material = materialRes.data as any

  if (!material || !material.is_published) return new Response('Not found', { status: 404 })
  if (material.club_id !== userClubId) return new Response('Forbidden', { status: 403 })
  if (!material.file_url) return new Response('PDF no disponible', { status: 404 })

  const path = extractPath(material.file_url)
  if (!path) return new Response('URL inválida', { status: 500 })

  const { data, error } = await admin.storage.from('materials').download(path)
  if (error || !data) return new Response('PDF no disponible', { status: 502 })

  const buffer = await data.arrayBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="material.pdf"',
    },
  })
}
