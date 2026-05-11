import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Si es un token de recuperación de contraseña, redirigir a la página de reset
      if (data.user && searchParams.get('type') === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`)
      }
      // Si es invitación de nuevo usuario, redirigir al reset para que establezca contraseña
      if (data.user && searchParams.get('type') === 'invite') {
        return NextResponse.redirect(`${origin}/auth/reset-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
