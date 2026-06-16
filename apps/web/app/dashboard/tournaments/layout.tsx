import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { redirect } from 'next/navigation'

export default async function TournamentsLayout({ children }: { children: React.ReactNode }) {
  const clubId = await getClubId()
  const features = await getClubFeatures(clubId ?? undefined)
  if (!features.enable_tournaments) redirect('/dashboard')
  return <>{children}</>
}
