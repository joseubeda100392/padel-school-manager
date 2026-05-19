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
  const role = user?.user_metadata?.role as string | undefined
  const path = request.nextUrl.pathname

  const isDashboard = path.startsWith('/dashboard')
  const isStudentArea = path.startsWith('/student')
  const isCoachArea = path.startsWith('/coach')

  if ((isDashboard || isStudentArea || isCoachArea) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}
