import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- module-level mocks so every call shares the same instances ---
const mockGetUser = vi.fn()
const mockAdminFrom = vi.fn()
const mockDirectFrom = vi.fn()
const mockCreateUser = vi.fn()
const mockDeleteUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockDirectFrom,
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
  })),
}))

vi.mock('@/lib/get-club', () => ({
  getClubId: vi.fn(async () => 'club-1'),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => null),
}))

import { POST } from '@/app/api/admin/import-students/route'

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/import-students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// chainable builder for getAdminClient().from().select().eq().single()
function adminChain(resolved: unknown) {
  const q: Record<string, unknown> = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    single: vi.fn(async () => resolved),
  }
  return q
}

// chainable builder for adminSupabase (createClient from @supabase/supabase-js)
function directChain(resolved: unknown) {
  const q: Record<string, unknown> = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    single: vi.fn(async () => resolved),
    insert: vi.fn(async () => ({ error: null })),
    upsert: vi.fn(async () => ({ error: null })),
  }
  return q
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
})

describe('POST /api/admin/import-students', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(makeReq({ rows: [] }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('No autorizado')
  })

  it('returns 403 when caller is a student', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'student-1' } } })
    mockAdminFrom.mockReturnValue(adminChain({ data: { role: 'student', club_id: 'club-1' }, error: null }))

    const res = await POST(makeReq({ rows: [{ nombre: 'Ana', email: 'ana@test.com' }] }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Sin permisos')
  })

  it('returns 400 when rows is empty', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockAdminFrom.mockReturnValue(adminChain({ data: { role: 'admin', club_id: 'club-1' }, error: null }))
    // clubs + levels queries still needed before rows validation
    mockDirectFrom
      .mockReturnValueOnce(directChain({ data: { id: 'club-1' }, error: null })) // clubs
      .mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) // levels

    const res = await POST(makeReq({ rows: [] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('rows requerido')
  })

  it('returns 400 when rows exceeds 500', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockAdminFrom.mockReturnValue(adminChain({ data: { role: 'admin', club_id: 'club-1' }, error: null }))
    mockDirectFrom
      .mockReturnValueOnce(directChain({ data: { id: 'club-1' }, error: null }))
      .mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) })

    const rows = Array.from({ length: 501 }, (_, i) => ({ nombre: `User${i}`, email: `u${i}@test.com` }))
    const res = await POST(makeReq({ rows }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Máximo 500 alumnos por importación')
  })

  it('marks row as error when nombre or email is empty', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockAdminFrom.mockReturnValue(adminChain({ data: { role: 'admin', club_id: 'club-1' }, error: null }))
    mockDirectFrom
      .mockReturnValueOnce(directChain({ data: { id: 'club-1' }, error: null }))
      .mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) })

    const res = await POST(makeReq({ rows: [{ nombre: '', email: '' }] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].status).toBe('error')
    expect(body.results[0].error).toBe('Nombre o email vacío')
  })

  it('marks row as error when email is already registered', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockAdminFrom.mockReturnValue(adminChain({ data: { role: 'admin', club_id: 'club-1' }, error: null }))
    mockDirectFrom
      .mockReturnValueOnce(directChain({ data: { id: 'club-1' }, error: null }))
      .mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) })
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered', status: 422 },
    })

    const res = await POST(makeReq({ rows: [{ nombre: 'Ana', email: 'ana@test.com' }] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].status).toBe('error')
    expect(body.results[0].error).toBe('Email ya registrado')
  })

  it('returns ok result with generated password on successful import', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockAdminFrom.mockReturnValue(adminChain({ data: { role: 'admin', club_id: 'club-1' }, error: null }))
    mockDirectFrom
      .mockReturnValueOnce(directChain({ data: { id: 'club-1' }, error: null })) // clubs
      .mockReturnValueOnce({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) // levels
      .mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) })   // users insert
      .mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ error: null }) })   // class_bag upsert
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-1' } },
      error: null,
    })

    const res = await POST(makeReq({ rows: [{ nombre: 'Ana', email: 'ana@test.com' }] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].status).toBe('ok')
    expect(body.results[0].email).toBe('ana@test.com')
    expect(body.results[0].password).toBeTruthy()
    expect(body.results[0].password).toHaveLength(10)
  })
})
