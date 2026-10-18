import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendPushToUsers: vi.fn() }))

import { isWaitlistable, overlaps, waitlistClassLabel, WAITLIST_MAX } from '@/lib/waitlist'

describe('isWaitlistable', () => {
  it('permite reservar una clase llena con una plaza puntual (3 fijos + 1 hueco cogido)', () => {
    expect(isWaitlistable({ capacity: 4, presentFixed: 3, bookedCount: 1 })).toBe(true)
  })

  it('no permite reservar si van los 4 fijos y nadie ha cogido hueco', () => {
    expect(isWaitlistable({ capacity: 4, presentFixed: 4, bookedCount: 0 })).toBe(false)
  })

  it('no permite reservar si queda hueco libre: se coge directamente', () => {
    expect(isWaitlistable({ capacity: 4, presentFixed: 2, bookedCount: 1 })).toBe(false)
  })

  it('permite reservar una clase sin fijos llena de reservas puntuales', () => {
    expect(isWaitlistable({ capacity: 4, presentFixed: 0, bookedCount: 4 })).toBe(true)
  })

  it('permite reservar si está llena aunque tenga más reservas que plazas (admin metió a alguien de más)', () => {
    expect(isWaitlistable({ capacity: 4, presentFixed: 4, bookedCount: 1 })).toBe(true)
  })
})

describe('overlaps', () => {
  const at = (h: number, m = 0) => `2026-10-01T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`
  it('detecta dos clases que se pisan', () => {
    expect(overlaps({ start_time: at(17), end_time: at(18) }, { start_time: at(17, 30), end_time: at(18, 30) })).toBe(true)
  })
  it('no cuenta como choque una clase que empieza justo cuando acaba la otra', () => {
    expect(overlaps({ start_time: at(17), end_time: at(18) }, { start_time: at(18), end_time: at(19) })).toBe(false)
  })
  it('compara solo la hora, aunque los horarios se crearan en días distintos', () => {
    expect(overlaps({ start_time: at(17), end_time: at(18) }, { start_time: '2026-03-05T17:15:00Z', end_time: '2026-03-05T18:15:00Z' })).toBe(true)
  })
})

describe('waitlistClassLabel', () => {
  it('pone el día de la fecha de la clase (no el del horario) y la hora de Madrid', () => {
    // Horario creado un lunes a las 17:00 UTC (19:00 en Madrid en verano);
    // la clase concreta es el martes 20 de octubre.
    expect(waitlistClassLabel('2026-10-19T17:00:00Z', '2026-10-20', 'Pista 2')).toBe('martes 20 de octubre a las 19:00 · Pista 2')
  })
  it('sin pista no añade el separador', () => {
    expect(waitlistClassLabel('2026-10-19T17:00:00Z', '2026-10-20')).toBe('martes 20 de octubre a las 19:00')
  })
})

it('el máximo de plazas en reserva es 2, como pidió el club', () => {
  expect(WAITLIST_MAX).toBe(2)
})
