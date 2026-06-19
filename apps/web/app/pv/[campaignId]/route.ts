export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: { campaignId: string } }) {
  const admin = getAdminClient()

  const { data: campaign } = await admin
    .from('pista_viva_campaigns')
    .select('id, playtomic_match_url, club_id, status')
    .eq('id', params.campaignId)
    .single()

  if (!campaign) return NextResponse.redirect(new URL('/', req.url))

  // Usuario logado (opcional, no bloquea si no está)
  let userId: string | null = null
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {}

  // Registrar clic e incrementar contador en paralelo, sin bloquear el redirect
  Promise.all([
    admin.from('pista_viva_clicks').insert({
      campaign_id: params.campaignId,
      user_id: userId,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0] ?? null,
    }),
    admin.rpc('increment_pista_viva_click', { campaign_id: params.campaignId }),
  ]).catch(() => {})

  // Fallback: página del club en Playtomic si no hay match URL aún
  const { data: club } = await admin
    .from('clubs')
    .select('playtomic_booking_url')
    .eq('id', campaign.club_id)
    .single()

  const redirectUrl =
    campaign.playtomic_match_url ??
    club?.playtomic_booking_url ??
    'https://playtomic.io'

  return NextResponse.redirect(redirectUrl)
}
