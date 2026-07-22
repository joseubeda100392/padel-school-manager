import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  // AVISO: user_metadata puede ser modificado por el usuario (no es fuente fiable de rol).
  // Este middleware solo controla redirecciones de navegación — NO es el control de acceso real.
  // La seguridad real está en las API routes (verifican rol desde la tabla users en DB).
  const role = user?.user_metadata?.role as string | undefined
  const path = request.nextUrl.pathname

  const isDashboard = path.startsWith('/dashboard')
  const isStudentArea = path.startsWith('/student')
  const isCoachArea = path.startsWith('/coach')

  if ((isDashboard || isStudentArea || isCoachArea) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // MFA enforcement temporalmente desactivado para presentación
  // TODO: reactivar tras la demo
  // if (isDashboard && user && (role === 'admin' || role === 'super_admin')) {
  //   const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  //   if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
  //     return NextResponse.redirect(new URL('/login/mfa', request.url))
  //   }
  // }

  if (user) {
    if (isDashboard && role === 'student') {
      return NextResponse.redirect(new URL('/student', request.url))
    }
    if (isDashboard && role === 'coach') {
      return NextResponse.redirect(new URL('/coach', request.url))
    }
    if (isStudentArea && role === 'coach') {
      return NextResponse.redirect(new URL('/coach', request.url))
    }
    if (path === '/') {
      if (role === 'student') return NextResponse.redirect(new URL('/student', request.url))
      if (role === 'coach') return NextResponse.redirect(new URL('/coach', request.url))
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/student/:path*',
    '/coach/:path*',
    '/login/:path*',
  ],
}
