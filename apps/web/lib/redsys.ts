import { createHmac, createCipheriv } from 'crypto'

const REDSYS_URL_TEST = 'https://sis-t.redsys.es:25443/sis/realizarPago'
const REDSYS_URL_PROD = 'https://sis.redsys.es/sis/realizarPago'

export function getRedsysUrl(env?: string | null): string {
  return (env ?? process.env.REDSYS_ENV) === 'production' ? REDSYS_URL_PROD : REDSYS_URL_TEST
}

function encrypt3DES(key: Buffer, data: string): Buffer {
  const iv = Buffer.alloc(8, 0)
  const messageBuf = Buffer.from(data, 'utf8')
  const padded = Buffer.alloc(Math.ceil(messageBuf.length / 8) * 8, 0)
  messageBuf.copy(padded)
  const cipher = createCipheriv('des-ede3-cbc', key, iv)
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(padded), cipher.final()])
}

export function generateSignature(secretKey: string, order: string, params: string): string {
  const keyBuffer = Buffer.from(secretKey, 'base64')
  const orderKey = encrypt3DES(keyBuffer, order)
  return createHmac('sha256', orderKey).update(params).digest('base64')
}

export function buildMerchantParameters(data: Record<string, string>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

export function verifySignature(secretKey: string, order: string, params: string, received: string): boolean {
  const expected = generateSignature(secretKey, order, params)
  const normalize = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/')
  return normalize(expected) === normalize(received)
}

export function generateOrderId(): string {
  // Redsys: 4-12 chars alfanuméricos, debe empezar por 4 dígitos
  const ts = Date.now().toString().slice(-8)
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return (ts + rand).slice(0, 12)
}

export function parseRedsysResponse(params: string): Record<string, string> {
  try {
    return JSON.parse(Buffer.from(params, 'base64').toString('utf8'))
  } catch {
    return {}
  }
}

export function isPaymentSuccessful(responseCode: string): boolean {
  const code = parseInt(responseCode, 10)
  return code >= 0 && code <= 99
}

// COF (Credential on File) — primer pago que inicia la domiciliación
export function buildCofInitParams(base: Record<string, string>): Record<string, string> {
  return {
    ...base,
    DS_MERCHANT_COF_INI: 'S',
    DS_MERCHANT_COF_TYPE: 'R',
  }
}

// MIT (Merchant Initiated Transaction) — cargo recurrente con token guardado
export function buildMitParams(base: Record<string, string>, identifier: string): Record<string, string> {
  return {
    ...base,
    DS_MERCHANT_COF_INI: 'N',
    DS_MERCHANT_COF_TYPE: 'R',
    DS_MERCHANT_IDENTIFIER: identifier,
    DS_MERCHANT_DIRECTPAYMENT: 'true',
  }
}

const REDSYS_REST_URL_TEST = 'https://sis-t.redsys.es:25443/sis/rest/trataPeticionREST'
const REDSYS_REST_URL_PROD = 'https://sis.redsys.es/sis/rest/trataPeticionREST'

export function getRedsysRestUrl(env?: string | null): string {
  return (env ?? process.env.REDSYS_ENV) === 'production' ? REDSYS_REST_URL_PROD : REDSYS_REST_URL_TEST
}

// Lanza un cargo MIT directo contra la API REST de Redsys (sin redirección del usuario)
export async function chargeMit(opts: {
  secretKey: string
  merchantCode: string
  terminal: string
  env?: string | null
  identifier: string
  amountCents: number
  orderId: string
}): Promise<{ success: boolean; responseCode: string; raw: Record<string, string> }> {
  const params: Record<string, string> = {
    DS_MERCHANT_MERCHANTCODE: opts.merchantCode,
    DS_MERCHANT_TERMINAL: opts.terminal,
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_AMOUNT: String(opts.amountCents),
    DS_MERCHANT_ORDER: opts.orderId,
    DS_MERCHANT_CURRENCY: '978',
    DS_MERCHANT_COF_INI: 'N',
    DS_MERCHANT_COF_TYPE: 'R',
    DS_MERCHANT_IDENTIFIER: opts.identifier,
    DS_MERCHANT_DIRECTPAYMENT: 'true',
  }

  const merchantParameters = buildMerchantParameters(params)
  const signature = generateSignature(opts.secretKey, opts.orderId, merchantParameters)

  const body = new URLSearchParams({
    Ds_SignatureVersion: 'HMAC_SHA256_V1',
    Ds_MerchantParameters: merchantParameters,
    Ds_Signature: signature,
  })

  const url = getRedsysRestUrl(opts.env)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const text = await res.text()
  let raw: Record<string, string> = {}
  try {
    const json = JSON.parse(text)
    if (json.Ds_MerchantParameters) {
      raw = parseRedsysResponse(json.Ds_MerchantParameters)
    }
  } catch {
    raw = { error: text }
  }

  const responseCode = raw.Ds_Response ?? '9999'
  return { success: isPaymentSuccessful(responseCode), responseCode, raw }
}
