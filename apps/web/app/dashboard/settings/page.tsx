export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/get-club'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const supabase = createClient()
  const admin = getAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  const clubId = await getClubId()

  const clubSlug = clubId
    ? (await admin.from('clubs').select('slug').eq('id', clubId).single()).data?.slug ?? null
    : null

  return <SettingsClient clubId={clubId} userId={user!.id} clubSlug={clubSlug} />
}
