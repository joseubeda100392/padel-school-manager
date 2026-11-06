import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { madridMinutesOfDay, madridDayOfWeek, madridDateStr, madridStartOfDay } from '@/lib/madrid-time'
import { overlaps } from '@/lib/schedule-overlap'

describe('hora de Madrid', () => {
  it('da la hora local en verano y en invierno', () => {
    expect(madridMinutesOfDay('2026-09-03T15:30:00Z')).toBe(17 * 60 + 30) // verano, UTC+2
    expect(madridMinutesOfDay('2026-11-05T15:00:00Z')).toBe(16 * 60)      // invierno, UTC+1
    expect(madridDayOfWeek('2026-11-05T15:00:00Z')).toBe(4)               // jueves
  })
})

describe('choque de horarios entre fechas de verano e invierno', () => {
  // Caso real (R3): monitor con clase el jueves 17:30–19:00 creada en septiembre;
  // se edita otra clase el jueves 16:00–17:30 desde el 5 de noviembre.
  const existing = [{ start_time: '2026-09-03T15:30:00Z', end_time: '2026-09-03T17:00:00Z', recurrence_end_date: '2027-07-28' }]

  it('16:00–17:30 en noviembre no choca con 17:30–19:00 creada en septiembre', () => {
    expect(overlaps('2026-11-05T15:00:00Z', '2026-11-05T16:30:00Z', '2027-07-28', existing)).toBe(false)
  })

  it('16:30–18:00 en noviembre sí choca', () => {
    expect(overlaps('2026-11-05T15:30:00Z', '2026-11-05T17:00:00Z', '2027-07-28', existing)).toBe(true)
  })
})

describe('fecha y medianoche de Madrid con el servidor en UTC', () => {
  const originalTz = process.env.TZ
  beforeAll(() => { process.env.TZ = 'UTC' })
  afterAll(() => { process.env.TZ = originalTz })

  it('a las 00:30 de España ya es el día siguiente aunque en UTC no', () => {
    expect(madridDateStr(new Date('2026-11-06T23:30:00Z'))).toBe('2026-11-07')
    expect(madridDateStr(new Date('2026-07-31T22:30:00Z'))).toBe('2026-08-01')
  })

  it('el primer instante de un día de España en invierno y en verano', () => {
    expect(madridStartOfDay('2026-11-01').toISOString()).toBe('2026-10-31T23:00:00.000Z')
    expect(madridStartOfDay('2026-07-01').toISOString()).toBe('2026-06-30T22:00:00.000Z')
  })

  it('el día del cambio de hora de octubre empieza a las 00:00 de verano', () => {
    expect(madridStartOfDay('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z')
    expect(madridStartOfDay('2026-10-26').toISOString()).toBe('2026-10-25T23:00:00.000Z')
  })
})
