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
  // Redsys: 4-12 chars, debe empezar por 4 dígitos
  return Date.now().toString().slice(-10)
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
