import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Supabase mocks ---
const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}))

import { POST, DELETE } from '@/app/api/bookings/route'

function json(body: unknown) {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function jsonDelete(body: unknown) {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function chainQ(resolved: unknown) {
  const q: Record<string, unknown> = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    neq: vi.fn(() => q),
    single: vi.fn(async () => resolved),
    maybeSingle: vi.fn(async () => resolved),
    delete: vi.fn(() => q),
    update: vi.fn(() => q),
    insert: vi.fn(async () => ({ error: null })),
  }
  return q
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---- POST ----

describe('POST /api/bookings', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(json({ scheduleId: '00000000-0000-0000-0000-000000000001' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('No autorizado')
  })

  it('returns 400 when scheduleId is not a valid UUID', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await POST(json({ scheduleId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('returns 409 when student already has a class at the same time', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const conflictSched = {
      start_time: '2024-01-15T10:00:00Z',
      end_time: '2024-01-15T11:00:00Z',
    }
    const existingBooking = {
      schedule_id: 'sched-other',
      schedules: conflictSched,
    }

    const schedQ = chainQ({ data: conflictSched, error: null })
    const bookingsQ = { ...chainQ({ data: [existingBooking], error: null }), select: vi.fn().mockReturnThis() }
    bookingsQ.neq = vi.fn().mockReturnValue({ ...bookingsQ, single: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: [existingBooking] }) })

    const overlapQ: Record<string, unknown> = {
      select: vi.fn(() => overlapQ),
      eq: vi.fn(() => overlapQ),
      neq: vi.fn(() => overlapQ),
    }
    ;(overlapQ as any)[Symbol.iterator] = undefined
    // Final resolution happens when the route awaits the query
    vi.mocked(overlapQ.neq as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(overlapQ)   // first .neq() → still chainable
      .mockResolvedValueOnce({ data: [existingBooking], error: null }) // second .neq() → resolves

    mockFrom
      .mockReturnValueOnce(schedQ)    // schedules select
      .mockReturnValueOnce(overlapQ)  // bookings overlap query

    const res = await POST(json({ scheduleId: '00000000-0000-0000-0000-000000000001' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Ya tienes una clase en ese horario')
  })

  it('returns booking data on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom
      .mockReturnValueOnce(chainQ({ data: null, error: null })) // schedules → no schedule (skip overlap)
    mockRpc.mockResolvedValue({ data: { booking_id: 'bk-1', new_balance: 4 }, error: null })

    const res = await POST(json({ scheduleId: '00000000-0000-0000-0000-000000000001' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.bookingId).toBe('bk-1')
  })
})

// ---- DELETE ----

describe('DELETE /api/bookings', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await DELETE(jsonDelete({ bookingId: '00000000-0000-0000-0000-000000000001' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when neither bookingId nor scheduleId provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const res = await DELETE(jsonDelete({}))
    expect(res.status).toBe(400)
  })

  it('returns 404 when booking does not exist for this student', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    mockFrom
      .mockReturnValueOnce(chainQ({ data: { role: 'student', club_id: 'club-1' }, error: null })) // users
      .mockReturnValueOnce(chainQ({ data: null, error: null }))                                    // bookings → not found

    const res = await DELETE(jsonDelete({ bookingId: '00000000-0000-0000-0000-000000000001' }))
    expect(res.status).toBe(404)
  })

  it('returns 403 when coach tries to cancel a booking from another coach class', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'coach-1' } } })

    const booking = { id: 'bk-1', source: 'bag', schedule_id: 'sched-1', student_id: 'student-1', club_id: 'club-1' }

    mockFrom
      .mockReturnValueOnce(chainQ({ data: { role: 'coach', club_id: 'club-1' }, error: null })) // users
      .mockReturnValueOnce(chainQ({ data: booking, error: null }))                               // bookings
      .mockReturnValueOnce(chainQ({ data: { coach_id: 'other-coach' }, error: null }))          // schedules

    const res = await DELETE(jsonDelete({ bookingId: '00000000-0000-0000-0000-000000000001' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('tus propias clases')
  })
})
