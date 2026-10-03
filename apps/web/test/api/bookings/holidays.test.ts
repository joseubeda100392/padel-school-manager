import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { HOLIDAY_ERROR } from '@/lib/club-holidays'

const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}))
vi.mock('@/lib/push', () => ({ sendPushToUsers: vi.fn() }))

import { POST as registerAbsence } from '@/app/api/schedule-exclusions/student/route'
import { POST as bookAbsenceSpot } from '@/app/api/bookings/spot/route'
import { POST as bookCapacitySpot } from '@/app/api/bookings/capacity-spot/route'

const HOLIDAY = '2099-10-12'
const WORKDAY = '2099-10-19'
const SCHEDULE_ID = '00000000-0000-0000-0000-000000000001'
const CLUB = { config: { holidays: [HOLIDAY] } }
// Lunes 2026-01-05 10:00 Madrid — HOLIDAY y WORKDAY también son lunes
const SCHEDULE = { id: SCHEDULE_ID, start_time: '2026-01-05T09:00:00Z', end_time: '2026-01-05T10:30:00Z', club_id: 'club-1', max_students: 4, recurrence_end_date: null }

const writes: string[] = []

function chain(table: string, resolved: unknown) {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'lte', 'not', 'order']) q[m] = vi.fn(() => q)
  for (const m of ['insert', 'update', 'delete', 'upsert']) q[m] = vi.fn(() => { writes.push(`${table}.${m}`); return q })
  q.single = vi.fn(async () => resolved)
  q.maybeSingle = vi.fn(async () => resolved)
  q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res)
  return q
}

function mockTables(tables: Record<string, unknown>) {
  mockFrom.mockImplementation((table: string) => chain(table, tables[table] ?? { data: null, error: null }))
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  writes.length = 0
  mockGetUser.mockResolvedValue({ data: { user: { id: 'student-1' } } })
})

describe('holidays — POST /api/schedule-exclusions/student', () => {
  beforeEach(() => mockTables({
    users: { data: { club_id: 'club-1' } },
    group_enrollments: { data: { id: 'enr-1' } },
    schedules: { data: SCHEDULE },
    clubs: { data: CLUB },
  }))

  it('rejects registering an absence on a club holiday without crediting the bag', async () => {
    const res = await registerAbsence(req({ scheduleId: SCHEDULE_ID, date: HOLIDAY }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(HOLIDAY_ERROR)
    expect(writes).toEqual([])
  })

  it('does not apply the holiday rule to a normal class day', async () => {
    const res = await registerAbsence(req({ scheduleId: SCHEDULE_ID, date: WORKDAY }))
    expect((await res.json()).error).not.toBe(HOLIDAY_ERROR)
  })
})

describe('holidays — POST /api/bookings/spot', () => {
  it('rejects booking an absence spot that falls on a holiday', async () => {
    mockTables({
      users: { data: { club_id: 'club-1' } },
      schedule_exclusions: { data: { id: 'ex-1', publish_spot: true, excluded_date: HOLIDAY } },
      schedules: { data: SCHEDULE },
      group_enrollments: { data: null },
      clubs: { data: CLUB },
    })
    const res = await bookAbsenceSpot(req({ exclusionId: 'ex-1', scheduleId: SCHEDULE_ID }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(HOLIDAY_ERROR)
    expect(writes).toEqual([])
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

describe('holidays — POST /api/bookings/capacity-spot', () => {
  beforeEach(() => mockTables({
    users: { data: { club_id: 'club-1' } },
    schedules: { data: SCHEDULE },
    clubs: { data: CLUB },
  }))

  it('rejects booking a free place on a holiday', async () => {
    const res = await bookCapacitySpot(req({ scheduleId: SCHEDULE_ID, date: HOLIDAY }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(HOLIDAY_ERROR)
    expect(writes).toEqual([])
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('lets a normal class day reach the booking RPC', async () => {
    mockRpc.mockResolvedValue({ data: { error: 'Clase completa' }, error: null })
    const res = await bookCapacitySpot(req({ scheduleId: SCHEDULE_ID, date: WORKDAY }))
    expect((await res.json()).error).not.toBe(HOLIDAY_ERROR)
    expect(mockRpc).toHaveBeenCalledWith('book_capacity_spot', expect.objectContaining({ p_class_date: WORKDAY }))
  })
})
