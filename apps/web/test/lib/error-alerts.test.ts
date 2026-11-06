import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createErrorAlerter, formatArgs, redact } from '@/lib/error-alerts'

type Sent = { subject: string; html: string }

function setup(overrides: { maxEntries?: number; failSend?: boolean } = {}) {
  const sent: Sent[] = []
  const logs: unknown[][] = []
  const alerter = createErrorAlerter({
    label: 'production',
    flushMs: 60_000,
    maxEntries: overrides.maxEntries ?? 20,
    send: async (subject, html) => {
      if (overrides.failSend) throw new Error('Resend caído')
      sent.push({ subject, html })
    },
    log: (...args) => logs.push(args),
  })
  return { alerter, sent, logs }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('redact', () => {
  test('oculta claves secretas, JWT y contraseñas de conexión', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    const text = `key sb_secret_AbC123xyz token ${jwt} url postgresql://postgres:miClave@db.x.co:5432/postgres`
    const out = redact(text)
    expect(out).not.toContain('sb_secret_AbC123xyz')
    expect(out).not.toContain(jwt)
    expect(out).not.toContain('miClave')
    expect(out).toContain('postgresql://postgres:***@db.x.co')
  })
})

describe('formatArgs', () => {
  test('incluye mensaje y primeras líneas de la pila de un Error', () => {
    const err = new Error('fallo al cobrar')
    const out = formatArgs(['[charge-mandates] chargeMit threw', err])
    expect(out).toContain('[charge-mandates] chargeMit threw')
    expect(out).toContain('fallo al cobrar')
  })

  test('convierte objetos a JSON sin romperse con referencias circulares', () => {
    const obj: Record<string, unknown> = { a: 1 }
    obj.self = obj
    expect(() => formatArgs(['x', obj])).not.toThrow()
  })
})

describe('createErrorAlerter', () => {
  test('agrupa varios errores en un solo correo al cumplirse el plazo', async () => {
    const { alerter, sent } = setup()
    alerter.capture(['[webhook] amount mismatch'])
    alerter.capture(['[charge-mandates] payment insert failed'])
    expect(sent).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sent).toHaveLength(1)
    expect(sent[0].subject).toContain('production')
    expect(sent[0].subject).toContain('2')
    expect(sent[0].html).toContain('[webhook] amount mismatch')
    expect(sent[0].html).toContain('[charge-mandates] payment insert failed')
  })

  test('cuenta las repeticiones del mismo error en vez de listarlo varias veces', async () => {
    const { alerter, sent } = setup()
    for (let i = 0; i < 5; i++) alerter.capture(['[webhook] booking_failed'])
    await alerter.flush()
    expect(sent[0].html.match(/booking_failed/g)).toHaveLength(1)
    expect(sent[0].html).toContain('×5')
  })

  test('no manda nada si no hubo errores', async () => {
    const { alerter, sent } = setup()
    await alerter.flush()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(sent).toHaveLength(0)
  })

  test('limita los errores distintos de un correo e indica cuántos se han omitido', async () => {
    const { alerter, sent } = setup({ maxEntries: 3 })
    for (let i = 0; i < 6; i++) alerter.capture([`error distinto ${i}`])
    await alerter.flush()
    expect(sent[0].html).toContain('error distinto 2')
    expect(sent[0].html).not.toContain('error distinto 3')
    expect(sent[0].html).toContain('3 errores distintos más')
  })

  test('escapa el HTML de los mensajes', async () => {
    const { alerter, sent } = setup()
    alerter.capture(['<script>alert(1)</script>'])
    await alerter.flush()
    expect(sent[0].html).not.toContain('<script>')
    expect(sent[0].html).toContain('&lt;script&gt;')
  })

  test('si falla el envío no lanza excepción y lo registra con el log original', async () => {
    const { alerter, logs } = setup({ failSend: true })
    alerter.capture(['algo'])
    await expect(alerter.flush()).resolves.toBeUndefined()
    expect(logs.flat().join(' ')).toContain('Resend caído')
  })

  test('ignora el ruido normal: sesiones caducadas, pestañas de versiones antiguas y conexiones cortadas', async () => {
    const { alerter, sent } = setup()
    const refresh = Object.assign(new Error('Invalid Refresh Token: Refresh Token Not Found'), { name: 'AuthApiError' })
    const used = Object.assign(new Error('Invalid Refresh Token: Already Used'), { name: 'AuthApiError' })
    const aborted = new Error('aborted')
    aborted.stack = 'Error: aborted\n    at abortIncoming (node:_http_server:796:17)'
    alerter.capture([refresh])
    alerter.capture(['', used])
    alerter.capture([new Error('Failed to find Server Action "x". This request might be from an older or newer deployment.')])
    alerter.capture([' ⨯', aborted])
    await alerter.flush()
    expect(sent).toHaveLength(0)
  })

  test('un error de verdad sí se avisa aunque haya ruido alrededor', async () => {
    const { alerter, sent } = setup()
    alerter.capture([new Error('Invalid Refresh Token: Already Used')])
    alerter.capture(['[webhook] single_class booking RPC failed: timeout'])
    await alerter.flush()
    expect(sent).toHaveLength(1)
    expect(sent[0].subject).toContain('1 error ')
    expect(sent[0].html).toContain('[webhook] single_class booking RPC failed')
  })

  test('tras enviar, los errores nuevos van en el correo siguiente', async () => {
    const { alerter, sent } = setup()
    alerter.capture(['primero'])
    await alerter.flush()
    alerter.capture(['segundo'])
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sent).toHaveLength(2)
    expect(sent[1].html).toContain('segundo')
    expect(sent[1].html).not.toContain('primero')
  })
})
