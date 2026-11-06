// Avisos por email de los errores del servidor (console.error), agrupados en un resumen.
import { escapeHtml } from '@/lib/email'

const STACK_LINES = 6
const MAX_MESSAGE_CHARS = 2000
const DEDUPE_KEY_CHARS = 300

type Send = (subject: string, html: string) => Promise<void>
type Log = (...args: unknown[]) => void

interface AlerterOptions {
  label: string
  flushMs: number
  maxEntries: number
  send: Send
  log: Log
}

interface Entry {
  message: string
  count: number
  firstAt: Date
}

export interface ErrorAlerter {
  capture: (args: unknown[]) => void
  flush: () => Promise<void>
}

const REDACTIONS: [RegExp, string][] = [
  [/sb_(secret|publishable)_[A-Za-z0-9_-]+/g, 'sb_$1_***'],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '***jwt***'],
  [/(postgres(?:ql)?:\/\/[^:/\s]+):[^@\s]+@/g, '$1:***@'],
  [/(Bearer\s+)[A-Za-z0-9._-]{10,}/g, '$1***'],
]

// Ruido normal visto en producción (nov 2026): no indica fallos de la app.
const IGNORED: RegExp[] = [
  /Invalid Refresh Token: (Refresh Token Not Found|Already Used)/,
  /Failed to find Server Action/,
  /Error: aborted\s+at abortIncoming/,
]

export function isIgnored(message: string): boolean {
  return IGNORED.some(re => re.test(message))
}

export function redact(text: string): string {
  return REDACTIONS.reduce((acc, [re, rep]) => acc.replace(re, rep), text)
}

function formatOne(arg: unknown): string {
  if (arg instanceof Error) {
    const stack = (arg.stack ?? '').split('\n').slice(0, STACK_LINES).join('\n')
    return stack || `${arg.name}: ${arg.message}`
  }
  if (typeof arg === 'string') return arg
  try {
    const seen = new WeakSet<object>()
    return JSON.stringify(arg, (_k, v: unknown) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[circular]'
        seen.add(v)
      }
      return v
    }) ?? String(arg)
  } catch {
    return String(arg)
  }
}

export function formatArgs(args: unknown[]): string {
  return redact(args.map(formatOne).join(' ')).slice(0, MAX_MESSAGE_CHARS)
}

function buildHtml(label: string, entries: Entry[], omitted: number): string {
  const items = entries.map(e => {
    const times = e.count > 1 ? ` <b>×${e.count}</b>` : ''
    const when = e.firstAt.toISOString().replace('T', ' ').slice(0, 19)
    return `<li style="margin-bottom:12px"><div style="color:#666;font-size:12px">${when} UTC${times}</div>`
      + `<pre style="white-space:pre-wrap;margin:4px 0;font-size:12px">${escapeHtml(e.message)}</pre></li>`
  }).join('')
  const more = omitted > 0 ? `<p>Y ${omitted} errores distintos más (ver los registros de Railway).</p>` : ''
  return `<p>Errores registrados en el servidor de ePadel School (<b>${escapeHtml(label)}</b>):</p><ul>${items}</ul>${more}`
}

export function createErrorAlerter(opts: AlerterOptions): ErrorAlerter {
  let entries = new Map<string, Entry>()
  let omitted = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  async function flush(): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null }
    if (entries.size === 0) return
    const batch = [...entries.values()]
    const batchOmitted = omitted
    entries = new Map()
    omitted = 0
    const total = batch.reduce((n, e) => n + e.count, 0)
    const subject = `[ePadel ${opts.label}] ${total} error${total === 1 ? '' : 'es'} en el servidor`
    try {
      await opts.send(subject, buildHtml(opts.label, batch, batchOmitted))
    } catch (err) {
      opts.log('[error-alerts] no se pudo enviar el aviso:', err)
    }
  }

  function capture(args: unknown[]): void {
    const message = formatArgs(args)
    if (isIgnored(message)) return
    const key = message.slice(0, DEDUPE_KEY_CHARS)
    const existing = entries.get(key)
    if (existing) {
      existing.count += 1
    } else if (entries.size >= opts.maxEntries) {
      omitted += 1
    } else {
      entries.set(key, { message, count: 1, firstAt: new Date() })
    }
    if (!timer) timer = setTimeout(() => { void flush() }, opts.flushMs)
  }

  return { capture, flush }
}
