// @ts-ignore - cache exists in React 18.3 runtime; @types/react version varies by environment
import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {}
        },
      },
    },
  )
}

export interface AuthUser {
  id: string
  email: string | null
  user_metadata: Record<string, any>
}

// Usuario de la sesión para PINTAR pantallas (páginas y layouts). La sesión
// va firmada con clave asimétrica (ES256) y getClaims() comprueba la firma en
// el propio servidor, sin llamar a Supabase: antes cada pantalla preguntaba
// 2-3 veces a Supabase (~200 ms cada una) solo para saber quién era.
// cache(): el layout y la página de una misma visita comparten la respuesta.
// Las rutas de la API que cambian datos siguen usando auth.getUser(), que sí
// pregunta a Supabase y detecta al momento una sesión cerrada o un usuario
// borrado.
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const { data, error } = await createClient().auth.getClaims()
  if (error || !data?.claims?.sub) return null
  const claims = data.claims as Record<string, any>
  return { id: claims.sub, email: claims.email ?? null, user_metadata: claims.user_metadata ?? {} }
})
