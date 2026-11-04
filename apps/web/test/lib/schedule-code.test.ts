import { describe, it, expect } from 'vitest'
import { nextScheduleCode } from '@/lib/schedule-code'

describe('nextScheduleCode', () => {
  it('propone el siguiente al más alto aunque falten números', () => {
    expect(nextScheduleCode(['GP001', 'GP042', 'GP044', 'GP040'])).toBe('GP045')
  })

  it('mantiene los ceros a la izquierda', () => {
    expect(nextScheduleCode(['GP008', 'GP009'])).toBe('GP010')
  })

  it('pasa de 999 a 1000 sin cortar', () => {
    expect(nextScheduleCode(['GP999'])).toBe('GP1000')
  })

  it('usa el prefijo más repetido', () => {
    expect(nextScheduleCode(['GP001', 'GP002', 'INT9'])).toBe('GP003')
  })

  it('sin códigos con número no propone nada', () => {
    expect(nextScheduleCode([null, undefined, 'Avanzado', ''])).toBe('')
    expect(nextScheduleCode([])).toBe('')
  })
})
