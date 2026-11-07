// Arranque del servidor (solo Node; lo llama instrumentation.ts).
// - En Railway, reenvía los console.error por email (resumen cada 5 min).
// - En producción, revisa con Redsys los pagos con tarjeta pendientes cada 10 min.
import { createErrorAlerter } from '@/lib/error-alerts'
import { sendEmail, INTERNAL_REPORT_TO } from '@/lib/email'
import { startIntervalTask } from '@/lib/interval-task'
import { runPaymentReconciliation } from '@/lib/payment-reconcile-run'

const FLUSH_MS = 5 * 60 * 1000
const MAX_ENTRIES = 25
const RECONCILE_EVERY_MS = 10 * 60 * 1000
const RECONCILE_FIRST_DELAY_MS = 60 * 1000

export async function registerNode(): Promise<void> {
  const label = process.env.RAILWAY_ENVIRONMENT_NAME
  if (!label) return

  startErrorAlerts(label)
  // Solo en producción: el entorno «rediseno» usa la misma base de datos y no
  // debe haber dos revisiones sobre los mismos pagos.
  if (label === 'production') startPaymentReconciliation()
}

function startErrorAlerts(label: string): void {
  if (!process.env.RESEND_API_KEY) return
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

function startPaymentReconciliation(): void {
  const stop = startIntervalTask({
    name: 'reconcile-payments',
    everyMs: RECONCILE_EVERY_MS,
    firstDelayMs: RECONCILE_FIRST_DELAY_MS,
    run: async () => {
      const summary = await runPaymentReconciliation()
      if (summary.checked) console.info('[reconcile-payments] pasada:', JSON.stringify(summary))
    },
    log: (...args) => console.error(...args),
  })
  console.info(`[reconcile-payments] revisión de pagos activa cada ${RECONCILE_EVERY_MS / 60000} min`)
  process.once('SIGTERM', stop)
}
