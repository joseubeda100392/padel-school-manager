export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const mandateId = req.nextUrl.searchParams.get('id')
  if (!mandateId) return NextResponse.json({ error: 'id requerido' })

  const admin = getAdminClient()

  const { data: mandate, error: mErr } = await admin
    .from('payment_mandates')
    .select('id, user_id, club_id, amount_cents, day_of_month, status')
    .eq('id', mandateId)
    .single()

  if (!mandate) return NextResponse.json({ error: 'mandate not found', mErr })

  const { data: club, error: cErr } = await admin
    .from('clubs')
    .select('name, redsys_merchant_code, redsys_merchant_terminal, redsys_env, redsys_secret_key')
    .eq('id', mandate.club_id)
    .single()

  return NextResponse.json({
    mandate,
    club: club ? {
      name: club.name,
      merchantCode: club.redsys_merchant_code,
      terminal: club.redsys_merchant_terminal,
      env: club.redsys_env,
      secretKeyPreview: club.redsys_secret_key ? club.redsys_secret_key.slice(-4) : null,
    } : null,
    clubError: cErr,
    envVars: {
      REDSYS_MERCHANT_CODE: process.env.REDSYS_MERCHANT_CODE ?? 'NOT SET',
      REDSYS_MERCHANT_TERMINAL: process.env.REDSYS_MERCHANT_TERMINAL ?? 'NOT SET',
    }
  })
}
