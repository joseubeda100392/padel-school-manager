import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- mocks ---
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockUpdate = vi.fn()
const mockNeq = vi.fn()
const mockInsert = vi.fn()
const mockRpc = vi.fn()
const mockMaybeSingle = vi.fn()

function chainable(overrides: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = {
    select: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    neq: vi.fn(() => obj),
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    update: vi.fn(() => obj),
    insert: vi.fn(async () => ({ error: null })),
    ...overrides,
  }
  return obj
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}))

vi.mock('@/lib/redsys', () => ({
  verifySignature: vi.fn(),
  parseRedsysResponse: vi.fn(),
  isPaymentSuccessful: vi.fn(),
}))

import { verifySignature, parseRedsysResponse, isPaymentSuccessful } from '@/lib/redsys'
import { POST } from '@/app/api/payments/webhook/route'

function makeRequest(params: Record<string, string>) {
  const body = new FormData()
  for (const [k, v] of Object.entries(params)) body.set(k, v)
  return new NextRequest('http://localhost/api/payments/webhook', {
    method: 'POST',
    body,
  })
}

const BASE_PAYMENT = {
  id: 'pay-1',
  status: 'pending',
  amount: '1000',
  club_id: 'club-1',
  user_id: 'user-1',
  type: 'single_class',
  metadata: { schedule_id: 'sched-1' },
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  process.env.REDSYS_SECRET_KEY = 'test-secret'
})

describe('POST /api/payments/webhook', () => {
  it('returns 400 when Ds_MerchantParameters is missing', async () => {
    const res = await POST(makeRequest({ Ds_Signature: 'sig' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Parámetros inválidos')
  })

  it('returns 400 when Ds_Signature is missing', async () => {
    const res = await POST(makeRequest({ Ds_MerchantParameters: 'params' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Parámetros inválidos')
  })

  it('returns 400 when payment order is not found in DB', async () => {
    vi.mocked(parseRedsysResponse).mockReturnValue({ Ds_Order: 'ORD001', Ds_Response: '0000' } as any)
    const chain = chainable()
    vi.mocked(chain.single).mockResolvedValue({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest({ Ds_MerchantParameters: 'p', Ds_Signature: 's' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when signature is invalid', async () => {
    vi.mocked(parseRedsysResponse).mockReturnValue({ Ds_Order: 'ORD001', Ds_Response: '0000' } as any)
    vi.mocked(verifySignature).mockReturnValue(false)

    const paymentChain = chainable()
    vi.mocked(paymentChain.single as any)
      .mockResolvedValueOnce({ data: BASE_PAYMENT, error: null }) // payments lookup
      .mockResolvedValueOnce({ data: null, error: null })          // clubs lookup

    mockFrom.mockReturnValue(paymentChain)

    const res = await POST(makeRequest({ Ds_MerchantParameters: 'p', Ds_Signature: 'bad-sig' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Solicitud no válida')
  })

  it('returns 400 when amount does not match payment record', async () => {
    vi.mocked(parseRedsysResponse).mockReturnValue({
      Ds_Order: 'ORD001', Ds_Response: '0000', Ds_Amount: '9999',
    } as any)
    vi.mocked(verifySignature).mockReturnValue(true)

    const chain = chainable()
    vi.mocked(chain.single as any)
      .mockResolvedValueOnce({ data: BASE_PAYMENT, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest({ Ds_MerchantParameters: 'p', Ds_Signature: 's' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Solicitud no válida')
  })

  it('returns already_processed when payment is not pending (idempotency)', async () => {
    vi.mocked(parseRedsysResponse).mockReturnValue({ Ds_Order: 'ORD001', Ds_Response: '0000' } as any)
    vi.mocked(verifySignature).mockReturnValue(true)

    const chain = chainable()
    vi.mocked(chain.single as any)
      .mockResolvedValueOnce({ data: { ...BASE_PAYMENT, status: 'succeeded' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const res = await POST(makeRequest({ Ds_MerchantParameters: 'p', Ds_Signature: 's' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.already_processed).toBe(true)
  })

  it('returns ok:false for a failed payment (response code non-zero)', async () => {
    vi.mocked(parseRedsysResponse).mockReturnValue({ Ds_Order: 'ORD001', Ds_Response: '9999' } as any)
    vi.mocked(verifySignature).mockReturnValue(true)
    vi.mocked(isPaymentSuccessful).mockReturnValue(false)

    const claimedChain = chainable()
    vi.mocked(claimedChain.single as any)
      .mockResolvedValueOnce({ data: BASE_PAYMENT, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    const updateChain = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: 'pay-1' }], error: null }),
    }

    mockFrom
      .mockReturnValueOnce(claimedChain) // payments select
      .mockReturnValueOnce(claimedChain) // clubs select
      .mockReturnValueOnce({ update: vi.fn(() => updateChain) }) // payments update

    const res = await POST(makeRequest({ Ds_MerchantParameters: 'p', Ds_Signature: 's' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })
})
