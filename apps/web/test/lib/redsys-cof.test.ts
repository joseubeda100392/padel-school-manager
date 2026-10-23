import { describe, it, expect } from 'vitest'
import { buildCofInitParams, buildMitParams } from '@/lib/redsys'

const base = { DS_MERCHANT_ORDER: '1234ABCD', DS_MERCHANT_AMOUNT: '6000' }

describe('pago automático con Redsys', () => {
  it('el primer pago pide a Redsys que guarde la tarjeta y devuelva la referencia', () => {
    expect(buildCofInitParams(base)).toMatchObject({
      ...base,
      DS_MERCHANT_IDENTIFIER: 'REQUIRED',
      DS_MERCHANT_COF_INI: 'S',
      DS_MERCHANT_COF_TYPE: 'R',
    })
  })

  it('los cobros mensuales usan la referencia guardada, sin el titular', () => {
    expect(buildMitParams(base, 'ref123')).toMatchObject({
      DS_MERCHANT_IDENTIFIER: 'ref123',
      DS_MERCHANT_COF_INI: 'N',
      DS_MERCHANT_COF_TYPE: 'R',
      DS_MERCHANT_DIRECTPAYMENT: 'true',
      DS_MERCHANT_EXCEP_SCA: 'MIT',
    })
  })
})
