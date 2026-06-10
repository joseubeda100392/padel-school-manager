import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/get-club'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const clubId = await getClubId()

  return <SettingsClient clubId={clubId} userId={user!.id} />
}
