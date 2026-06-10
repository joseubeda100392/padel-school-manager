// @ts-expect-error - cache exists in React 18.3 runtime but is missing from @types/react 18.x
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export const getClubId = cache(async (): Promise<string | null> => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role, club_id').eq('id', user.id).single()
  if (!data || data.role === 'super_admin') return null
  return (data.club_id as string) ?? null
})

export const isSuperAdmin = cache(async (): Promise<boolean> => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  return data?.role === 'super_admin'
})
