import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'

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

  const res = await fetch(material.file_url)
  if (!res.ok) return new Response('PDF no disponible', { status: 502 })

  return new Response(res.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="material.pdf"',
    },
  })
}
