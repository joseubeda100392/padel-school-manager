export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { sendPushToUsers } from '@/lib/push'

const HOME_BY_ROLE: Record<string, string> = { student: '/student', coach: '/coach', admin: '/dashboard', super_admin: '/dashboard' }

// "Enviarme un aviso de prueba": solo a uno mismo, para comprobar que los
// avisos llegan a su móvil (lo primero que se pide cuando alguien dice que no
// le llegan).
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const limited = rateLimit(req, `push-test:${user.id}`, { limit: 3, windowMs: 10 * 60 * 1000 })
  if (limited) return limited

  const { data: profile } = await getAdminClient().from('users').select('role').eq('id', user.id).single()
  const { pushed } = await sendPushToUsers([user.id], {
    title: '🔔 Aviso de prueba',
    body: '¡Funciona! Así te llegarán los avisos del club.',
    url: HOME_BY_ROLE[profile?.role ?? 'student'] ?? '/student',
  }, 'admin_message')

  return NextResponse.json({ ok: true, pushed })
}
