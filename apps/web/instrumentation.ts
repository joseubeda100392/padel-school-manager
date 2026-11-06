// Se ejecuta una vez al arrancar el servidor. En Railway, reenvía los console.error por email (resumen cada 5 min).
const FLUSH_MS = 5 * 60 * 1000
const MAX_ENTRIES = 25

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const label = process.env.RAILWAY_ENVIRONMENT_NAME
  if (!label || !process.env.RESEND_API_KEY) return

  const { createErrorAlerter } = await import('@/lib/error-alerts')
  const { sendEmail, INTERNAL_REPORT_TO } = await import('@/lib/email')
  const originalError = console.error.bind(console)

  const alerter = createErrorAlerter({
    label,
    flushMs: FLUSH_MS,
    maxEntries: MAX_ENTRIES,
    send: (subject, html) => sendEmail({ to: INTERNAL_REPORT_TO, subject, html }),
    log: originalError,
  })

  console.error = (...args: unknown[]) => {
    originalError(...args)
    try { alerter.capture(args) } catch { /* el aviso nunca debe romper el log */ }
  }

  process.once('SIGTERM', () => { void alerter.flush() })
}
