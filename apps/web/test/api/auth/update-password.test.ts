import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- mocks ---
const mockGetUser = vi.fn()
const mockUpdateUserById = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        updateUserById: mockUpdateUserById,
      },
    },
  })),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => null),
}))

import { POST } from '@/app/api/auth/update-password/route'

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/auth/update-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
})

describe('POST /api/auth/update-password', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(makeReq({ password: 'newpass123' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('No autorizado')
  })

  it('returns 400 when password is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Contraseña inválida')
  })

  it('returns 400 when password is too short (< 6 chars)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await POST(makeReq({ password: 'abc' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Contraseña inválida')
  })

  it('returns 400 when password is not a string', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await POST(makeReq({ password: 12345 }))
    expect(res.status).toBe(400)
  })

  it('returns 500 when admin updateUserById fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockUpdateUserById.mockResolvedValue({
      data: { user: null },
      error: { message: 'Internal error', status: 500 },
    })

    const res = await POST(makeReq({ password: 'newsecurepass' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Error al actualizar la contraseña')
  })

  it('returns ok:true on successful password update', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockUpdateUserById.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const res = await POST(makeReq({ password: 'newsecurepass' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('does not expose raw error messages in response', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockUpdateUserById.mockResolvedValue({
      data: { user: null },
      error: { message: 'relation "auth.users" does not exist — postgres internal', status: 500 },
    })

    const res = await POST(makeReq({ password: 'newsecurepass' }))
    const body = await res.json()
    expect(body.error).not.toContain('postgres')
    expect(body.error).not.toContain('relation')
    expect(body.error).toBe('Error al actualizar la contraseña')
  })
})
