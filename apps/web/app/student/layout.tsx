import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { StudentShell } from '@/components/layout/student-shell'
import { getClubFeatures } from '@/lib/get-club-features'
import { TermsGate } from './terms-gate'
import { PasswordChangeGate } from './password-change-gate'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: userData, error: userError } = await admin
    .from('users')
    .select('role, also_student, name, club_id, clubs(name), force_password_change')
    .eq('id', user.id)
    .single()

  if (userError) console.error('[student/layout] users query failed:', userError.message)

  const role = (userData as any)?.role as string | undefined
  const alsoStudent = (userData as any)?.also_student === true
  // Lista blanca estricta: solo 'student', o un 'coach' marcado explícitamente
  // como also_student, se queda aquí. Cualquier otra cosa (coach normal,
  // admin, o sin fila en absoluto) se manda a su sitio real en vez de dejar
  // pasar por defecto cuando el rol no se pudo leer.
  if (role === 'coach' && !alsoStudent) redirect('/coach')
  if (role !== 'student' && !(role === 'coach' && alsoStudent)) redirect('/dashboard')

  const clubId = (userData as any)?.club_id as string | undefined

  const [{ data: bag }, { count: unreadCount }, features] = await Promise.all([
    admin.from('class_bag').select('balance_60, balance_90').eq('user_id', user.id).single(),
    admin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
    getClubFeatures(clubId),
  ])

  const clubName = (userData as any)?.clubs?.name ?? 'Tu Club'

  if ((userData as any)?.force_password_change) {
    return <PasswordChangeGate clubName={clubName} />
  }

  let termsAcceptedAt: string | null = null
  if (features.enable_terms) {
    const { data: termsRow } = await admin
      .from('users')
      .select('terms_accepted_at')
      .eq('id', user.id)
      .single()
    termsAcceptedAt = (termsRow as any)?.terms_accepted_at ?? null
  }

  if (features.enable_terms && !termsAcceptedAt) {
    return <TermsGate pdfUrl={features.terms_pdf_url} clubName={clubName} />
  }

  return (
    <StudentShell
      userName={(userData as any)?.name ?? undefined}
      clubName={clubName}
      bagBalance={(bag?.balance_60 ?? 0) + (bag?.balance_90 ?? 0)}
      unreadCount={unreadCount ?? 0}
      features={features}
      isAlsoCoach={role === 'coach'}
    >
      {children}
    </StudentShell>
  )
}
