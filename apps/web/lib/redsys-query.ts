import { generateSignature, isPaymentSuccessful } from '@/lib/redsys'

// Consulta a Redsys el estado real de un pedido (servicio SOAP de consultas,
// «Transacción Simple»). Sirve para no depender del aviso (webhook): Redsys a
// veces cobra y no avisa (R3, 4-11-2026: tres cuotas cobradas sin aviso).
const QUERY_URL_TEST = 'https://sis-t.redsys.es:25443/apl02/services/SerClsWSConsulta'
const QUERY_URL_PROD = 'https://sis.redsys.es/apl02/services/SerClsWSConsulta'
const TIMEOUT_MS = 20_000

export interface RedsysMerchant {
  merchantCode: string
  terminal: string
  secretKey: string
  env: string | null
}

// paid: cobrado. denied: terminado sin cobro (tarjeta rechazada, error).
// open: el alumno aún no ha terminado (puede terminar todavía).
// missing: Redsys no conoce el pedido (nunca llegó a abrir la pasarela).
export type RedsysOutcome = 'paid' | 'denied' | 'open' | 'missing'

export interface RedsysOrderStatus {
  outcome: RedsysOutcome
  responseCode: string | null
  state: string | null
  amount: string | null
}

const tag = (xml: string, name: string): string | null => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? null

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

export function buildQueryEnvelope(merchant: RedsysMerchant, order: string): string {
  const version = `<Version Ds_Version="0.0"><Message><Transaction><Ds_MerchantCode>${merchant.merchantCode}</Ds_MerchantCode>`
    + `<Ds_Terminal>${merchant.terminal}</Ds_Terminal><Ds_Order>${order}</Ds_Order>`
    + '<Ds_TransactionType>0</Ds_TransactionType></Transaction></Message></Version>'
  const signature = generateSignature(merchant.secretKey, order, version)
  const messages = `<Messages>${version}<Signature>${signature}</Signature><SignatureVersion>HMAC_SHA256_V1</SignatureVersion></Messages>`
  return '<?xml version="1.0"?>\n<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webservices.apl02.redsys.es">'
    + `<soapenv:Header/><soapenv:Body><web:consultaOperaciones><cadenaXML><![CDATA[${messages}]]></cadenaXML></web:consultaOperaciones></soapenv:Body></soapenv:Envelope>`
}

// Ds_State: S solicitada, P/A en curso (autenticando), F finalizada.
// XML0024: el pedido no existe en Redsys.
export function parseQueryResponse(body: string): RedsysOrderStatus {
  const xml = unescapeXml(body)
  const responseCode = tag(xml, 'Ds_Response')
  const state = tag(xml, 'Ds_State')
  const amount = tag(xml, 'Ds_Amount')
  const errorCode = tag(xml, 'Ds_ErrorCode') ?? tag(xml, 'CODIGO')

  if (errorCode === 'XML0024') return { outcome: 'missing', responseCode: null, state: null, amount: null }
  if (state === 'F' && responseCode) {
    return { outcome: isPaymentSuccessful(responseCode) ? 'paid' : 'denied', responseCode, state, amount }
  }
  if (state === 'S' || state === 'P' || state === 'A') return { outcome: 'open', responseCode, state, amount }
  throw new Error(`Respuesta de Redsys no reconocida${errorCode ? ` (${errorCode})` : ''}`)
}

export async function queryRedsysOrder(merchant: RedsysMerchant, order: string): Promise<RedsysOrderStatus> {
  const url = (merchant.env ?? process.env.REDSYS_ENV) === 'production' ? QUERY_URL_PROD : QUERY_URL_TEST
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml;charset=utf-8', SOAPAction: 'consultaOperaciones' },
    body: buildQueryEnvelope(merchant, order),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Redsys respondió ${res.status} a la consulta del pedido ${order}`)
  return parseQueryResponse(await res.text())
}
