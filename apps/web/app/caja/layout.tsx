import { getAuthUser } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { CashierShell } from '@/components/layout/cashier-shell'
import { CASHIER_ROLE } from '@/lib/cashier'

// Zona del cobrador. Cualquier otro rol vuelve a la suya (el panel le redirige).
export default async function CajaLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const { data: profile } = await getAdminClient()
    .from('users')
    .select('role, name, club_id, clubs(name)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== CASHIER_ROLE) redirect('/dashboard')

  return (
    <CashierShell userName={profile.name ?? undefined} clubName={(profile as any)?.clubs?.name ?? undefined}>
      {profile.club_id ? children : <p className="text-body text-ink-2">Tu usuario no tiene club asignado. Pide al club que lo revise.</p>}
    </CashierShell>
  )
}
