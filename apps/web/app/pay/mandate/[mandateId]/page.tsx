import { getAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import {
  generateOrderId,
  buildMerchantParameters,
  buildCofInitParams,
  generateSignature,
  getRedsysUrl,
} from '@/lib/redsys'

export default async function MandatePayPage({ params }: { params: { mandateId: string } }) {
  const admin = getAdminClient()

  const { data: mandate } = await admin
    .from('payment_mandates')
    .select('id, user_id, club_id, amount_cents, day_of_month, status')
    .eq('id', params.mandateId)
    .single()

  if (!mandate || mandate.status === 'cancelled') notFound()

  const { data: club } = await admin
    .from('clubs')
    .select('redsys_merchant_code, redsys_secret_key, redsys_merchant_terminal, redsys_env')
    .eq('id', mandate.club_id)
    .single()

  const merchantCode = club?.redsys_merchant_code ?? process.env.REDSYS_MERCHANT_CODE ?? ''
  const secretKey = club?.redsys_secret_key ?? process.env.REDSYS_SECRET_KEY ?? ''
  const terminal = club?.redsys_merchant_terminal ?? process.env.REDSYS_MERCHANT_TERMINAL ?? '001'
  const env = club?.redsys_env ?? null

  // Cancelar pagos pending anteriores de este mandato para evitar duplicados
  await admin
    .from('payments')
    .update({ status: 'failed' })
    .eq('status', 'pending')
    .contains('metadata', { mandate_id: mandate.id })

  const orderId = generateOrderId()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  await admin.from('payments').insert({
    user_id: mandate.user_id,
    club_id: mandate.club_id,
    amount: mandate.amount_cents,
    currency: 'eur',
    type: 'mandate_init',
    status: 'pending',
    redsys_order_id: orderId,
    metadata: { mandate_id: mandate.id },
  })

  const baseParams: Record<string, string> = {
    DS_MERCHANT_MERCHANTCODE: merchantCode,
    DS_MERCHANT_TERMINAL: terminal,
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_AMOUNT: String(mandate.amount_cents),
    DS_MERCHANT_ORDER: orderId,
    DS_MERCHANT_CURRENCY: '978',
    DS_MERCHANT_URLOK: `${baseUrl}/pay/mandate-ok`,
    DS_MERCHANT_URLKO: `${baseUrl}/pay/mandate-ko`,
    DS_MERCHANT_MERCHANTURL: `${baseUrl}/api/payments/webhook`,
  }

  const params2 = buildCofInitParams(baseParams)
  const merchantParameters = buildMerchantParameters(params2)
  const signature = generateSignature(secretKey, orderId, merchantParameters)
  const redsysUrl = getRedsysUrl(env)

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-sm text-center">
        <p className="mb-4 text-sm text-gray-500">Redirigiendo al sistema de pago seguro...</p>
        <form id="redsys-form" method="POST" action={redsysUrl}>
          <input type="hidden" name="Ds_SignatureVersion" value="HMAC_SHA256_V1" />
          <input type="hidden" name="Ds_MerchantParameters" value={merchantParameters} />
          <input type="hidden" name="Ds_Signature" value={signature} />
          <button type="submit" className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-medium text-white hover:bg-brand-600">
            Ir al pago →
          </button>
        </form>
        <script dangerouslySetInnerHTML={{ __html: `document.getElementById('redsys-form').submit()` }} />
      </div>
    </div>
  )
}
