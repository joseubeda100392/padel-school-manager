import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { NotificationsClient } from './notifications-client'

export default async function NotificationsPage() {
  const clubId = await getClubId()
  const features = await getClubFeatures(clubId ?? undefined)

  return <NotificationsClient enablePayments={features.enable_payments} />
}
