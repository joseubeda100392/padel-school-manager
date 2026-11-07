export const dynamic = 'force-dynamic'
export const maxDuration = 300
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runPaymentReconciliation } from '@/lib/payment-reconcile-run'

// Respaldo del temporizador de la app (instrumentation.ts): el cron de GitHub
// llama aquí. ?club=<id> limita la revisión a un club (pruebas en «Escuela - prueba»).
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET ?? ''
  const authBuf = Buffer.from(req.headers.get('authorization') ?? '')
  const expBuf = Buffer.from(`Bearer ${cronSecret}`)
  return !!cronSecret && authBuf.length === expBuf.length && timingSafeEqual(authBuf, expBuf)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const onlyClub = req.nextUrl.searchParams.get('club')
  if (onlyClub && !/^[0-9a-f-]{36}$/.test(onlyClub)) return NextResponse.json({ error: 'Club no válido' }, { status: 400 })
  try {
    const summary = await runPaymentReconciliation({ onlyClub })
    return NextResponse.json({ ok: true, ...summary })
  } catch (e) {
    console.error('[reconcile-payments]', e)
    return NextResponse.json({ error: 'Error al revisar los pagos' }, { status: 500 })
  }
}
