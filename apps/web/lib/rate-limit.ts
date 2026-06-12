import { NextRequest, NextResponse } from 'next/server'

// Ventana deslizante en memoria. Suficiente para Railway single-instance;
// migrar a Upstash/Redis si se escala a varias instancias.
const buckets = new Map<string, number[]>()

const MAX_BUCKETS = 10_000

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export function rateLimit(
  req: NextRequest,
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): NextResponse | null {
  const now = Date.now()
  const bucketKey = `${key}:${clientIp(req)}`

  if (buckets.size > MAX_BUCKETS) buckets.clear()

  const hits = (buckets.get(bucketKey) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } },
    )
  }

  hits.push(now)
  buckets.set(bucketKey, hits)
  return null
}
