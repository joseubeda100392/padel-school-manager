export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { parseBody } from '@/lib/validate'
import { rateLimit } from '@/lib/rate-limit'
import { getAdminClient } from '@/lib/supabase/admin'
import { normalizePhone, phoneSearchPattern, placeholderEmailFor } from '@/lib/login-identifier'

// Entrar con el teléfono. El servidor busca la cuenta de ese teléfono y entra
// con su email y la contraseña escrita. Como todas las peticiones a Supabase
// salen desde la IP del servidor, se le pasa la IP real del alumno en
// Sb-Forwarded-For (requiere la clave secreta sb_secret_ y "IP Address
// Forwarding" activado en Supabase); si no, a los 30 intentos seguidos
// Supabase bloquearía el acceso a todos.

const WRONG = 'Teléfono o contraseña incorrectos'
const SHARED = 'Ese teléfono lo usan varias cuentas: entra con tu email.'
const MAX_FAILS = 5
const FAIL_WINDOW_MS = 15 * 60_000
const MAX_TRACKED_PHONES = 10_000
const failsByPhone = new Map<string, number[]>()

function recentFails(phone: string): number[] {
  const now = Date.now()
  return (failsByPhone.get(phone) ?? []).filter(t => now - t < FAIL_WINDOW_MS)
}

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'login-phone', { limit: 20, windowMs: FAIL_WINDOW_MS })
  if (limited) return limited

  const { data: body, error: badRequest } = await parseBody(req, z.object({
    phone: z.string().min(9).max(30),
    password: z.string().min(1).max(200),
  }))
  if (badRequest) return badRequest

  const phone = normalizePhone(body.phone)
  if (!phone) return NextResponse.json({ error: WRONG }, { status: 401 })

  if (recentFails(phone).length >= MAX_FAILS) {
    return NextResponse.json({ error: 'Demasiados intentos con ese teléfono. Inténtalo dentro de 15 minutos.' }, { status: 429 })
  }

  const admin = getAdminClient()
  const [byPhone, byPlaceholder] = await Promise.all([
    admin.from('users').select('id, email, phone').eq('is_active', true).ilike('phone', phoneSearchPattern(phone)).limit(20),
    admin.from('users').select('id, email, phone').eq('is_active', true).eq('email', placeholderEmailFor(phone)!).limit(1),
  ])
  if (byPhone.error || byPlaceholder.error) {
    console.error('[login-phone] búsqueda fallida:', (byPhone.error ?? byPlaceholder.error)?.message)
    return NextResponse.json({ error: 'No se ha podido entrar. Inténtalo de nuevo.' }, { status: 500 })
  }
  const accounts = new Map<string, string>()
  for (const u of byPhone.data ?? []) if (normalizePhone(u.phone) === phone) accounts.set(u.id, u.email)
  for (const u of byPlaceholder.data ?? []) accounts.set(u.id, u.email)

  if (accounts.size > 1) return NextResponse.json({ error: SHARED, code: 'shared_phone' }, { status: 409 })

  const email = accounts.values().next().value as string | undefined
  if (email) {
    const ip = clientIp(req)
    const cookieStore = cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
      global: { headers: ip ? { 'Sb-Forwarded-For': ip } : {} },
    })
    const { error } = await supabase.auth.signInWithPassword({ email, password: body.password })
    if (!error) {
      failsByPhone.delete(phone)
      return NextResponse.json({ ok: true })
    }
    if (error.status === 429) {
      return NextResponse.json({ error: 'Demasiados intentos. Inténtalo dentro de unos minutos.' }, { status: 429 })
    }
  }

  if (failsByPhone.size >= MAX_TRACKED_PHONES) failsByPhone.delete(failsByPhone.keys().next().value as string)
  failsByPhone.set(phone, [...recentFails(phone), Date.now()])
  return NextResponse.json({ error: WRONG }, { status: 401 })
}
