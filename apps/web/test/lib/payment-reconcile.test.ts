import { describe, it, expect } from 'vitest'
import { buildQueryEnvelope, parseQueryResponse } from '@/lib/redsys-query'
import { decideReconcile, ABANDON_AFTER_MS } from '@/lib/payment-reconcile'
import { paymentConcept, paymentStatus } from '@/lib/payment-concept'
import { generateSignature } from '@/lib/redsys'

const soap = (inner: string) =>
  `<soapenv:Envelope><soapenv:Body><p259:consultaOperacionesResponse><consultaOperacionesReturn>${inner
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')}</consultaOperacionesReturn></p259:consultaOperacionesResponse></soapenv:Body></soapenv:Envelope>`

const response = (fields: string) => soap(`<Messages><Version Ds_Version="0.0"><Message><Response>${fields}</Response></Message></Version></Messages>`)

describe('parseQueryResponse', () => {
  it('cobrado: respuesta 0000 y estado F (respuesta real del pedido de Pablo Rojo)', () => {
    const r = parseQueryResponse(response('<Ds_Order>898449750804</Ds_Order><Ds_Amount>6800</Ds_Amount><Ds_State>F</Ds_State><Ds_Response>0000</Ds_Response>'))
    expect(r).toEqual({ outcome: 'paid', responseCode: '0000', state: 'F', amount: '6800' })
  })
  it('también acepta la respuesta sin escapar', () => {
    expect(parseQueryResponse('<Response><Ds_State>F</Ds_State><Ds_Response>0099</Ds_Response></Response>').outcome).toBe('paid')
  })
  it('denegado: estado F con código de error', () => {
    expect(parseQueryResponse(response('<Ds_State>F</Ds_State><Ds_Response>9999</Ds_Response>')).outcome).toBe('denied')
    expect(parseQueryResponse(response('<Ds_State>F</Ds_State><Ds_Response>0190</Ds_Response>')).outcome).toBe('denied')
  })
  it('sin terminar: estados S, P y A', () => {
    for (const s of ['S', 'P', 'A']) expect(parseQueryResponse(response(`<Ds_State>${s}</Ds_State>`)).outcome).toBe('open')
  })
  it('pedido que Redsys no conoce (XML0024)', () => {
    expect(parseQueryResponse(soap('<Messages><Version><Message><ErrorMsg><Ds_ErrorCode>XML0024</Ds_ErrorCode></ErrorMsg></Message></Version></Messages>')).outcome).toBe('missing')
  })
  it('respuesta desconocida: error, nunca se da por cobrado ni por abandonado', () => {
    expect(() => parseQueryResponse(response('<Ds_ErrorCode>SIS0042</Ds_ErrorCode>'))).toThrow(/SIS0042/)
  })
})

describe('buildQueryEnvelope', () => {
  it('firma el bloque Version con la clave del pedido, como el pago', () => {
    const merchant = { merchantCode: '999008881', terminal: '001', secretKey: 'sq7HjrUOBfKmC576ILgskD5srU870gJ7', env: null }
    const xml = buildQueryEnvelope(merchant, '1234ABCD5678')
    const version = xml.match(/<Version[\s\S]*<\/Version>/)![0]
    expect(version).toContain('<Ds_Order>1234ABCD5678</Ds_Order>')
    expect(xml).toContain(`<Signature>${generateSignature(merchant.secretKey, '1234ABCD5678', version)}</Signature>`)
    expect(xml).toContain('<SignatureVersion>HMAC_SHA256_V1</SignatureVersion>')
  })
})

describe('decideReconcile', () => {
  const now = new Date('2026-11-07T12:00:00Z')
  const fee = { amount: 6800, type: 'fixed_group_month', created_at: '2026-11-07T11:30:00Z' }
  const st = (outcome: any, extra: Partial<{ amount: string | null }> = {}) => ({ outcome, responseCode: null, state: null, amount: null, ...extra })

  it('cobrado con el mismo importe: se aplica', () => {
    expect(decideReconcile(fee, st('paid', { amount: '6800' }), now).decision).toBe('settle')
  })
  it('cobrado con otro importe: a revisar, no se aplica', () => {
    expect(decideReconcile(fee, st('paid', { amount: '8000' }), now)).toEqual({ decision: 'review', detail: 'importe en Redsys 8000 y en la app 6800' })
  })
  it('alta de domiciliación cobrada sin aviso: a revisar (falta el identificador de la tarjeta)', () => {
    expect(decideReconcile({ ...fee, type: 'mandate_init' }, st('paid', { amount: '6800' }), now).decision).toBe('review')
  })
  it('cobro de domiciliación a medias: nunca se aplica solo, a revisar', () => {
    const mit = { ...fee, type: 'mandate_charge' }
    expect(decideReconcile(mit, st('paid', { amount: '6800' }), now).decision).toBe('review')
    expect(decideReconcile(mit, st('denied'), now).decision).toBe('review')
    expect(decideReconcile(mit, st('open'), now).decision).toBe('wait')
    expect(decideReconcile(mit, st('missing'), new Date(new Date(fee.created_at).getTime() + ABANDON_AFTER_MS)).decision).toBe('review')
  })
  it('denegado: se cierra como fallido aunque sea reciente', () => {
    expect(decideReconcile(fee, st('denied'), now).decision).toBe('settle')
  })
  it('sin terminar: espera hasta 2 horas y después se da por abandonado', () => {
    const justBefore = new Date(new Date(fee.created_at).getTime() + ABANDON_AFTER_MS - 1)
    const atLimit = new Date(new Date(fee.created_at).getTime() + ABANDON_AFTER_MS)
    expect(decideReconcile(fee, st('open'), justBefore).decision).toBe('wait')
    expect(decideReconcile(fee, st('open'), atLimit).decision).toBe('abandon')
    expect(decideReconcile(fee, st('missing'), atLimit).decision).toBe('abandon')
  })
})

describe('etiquetas de un pago abandonado', () => {
  const base = { type: 'fixed_group_month', created_at: '2026-11-04T10:00:00Z' }
  it('en el panel sale «Sin terminar», no «Fallido»', () => {
    expect(paymentStatus({ ...base, status: 'failed', metadata: { abandoned: true } })).toEqual({ key: 'unfinished', label: 'Sin terminar' })
    expect(paymentStatus({ ...base, status: 'failed', metadata: {} })).toEqual({ key: 'failed', label: 'Fallido' })
  })
  it('el concepto dice «sin terminar», no «rechazado»', () => {
    expect(paymentConcept({ ...base, status: 'failed', metadata: { abandoned: true } as any }).title).toBe('Pago con tarjeta sin terminar')
    expect(paymentConcept({ ...base, status: 'failed', metadata: {} }).title).toBe('Pago con tarjeta rechazado')
  })
  it('cobrado sin aviso y pendiente de revisar: «A revisar»', () => {
    expect(paymentStatus({ ...base, status: 'pending', metadata: { redsys_check: { review: 'x' } } }).label).toBe('A revisar')
  })
})
