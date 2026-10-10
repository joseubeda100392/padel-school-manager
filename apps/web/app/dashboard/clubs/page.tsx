export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CircleCheck, CircleX, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ClubManageButton } from '@/components/clubs/club-manage-button'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'

const planLabel: Record<string, string> = {
  trial: 'Trial',
  basic: 'Basic',
  pro: 'Pro',
}

const planTone: Record<string, 'neutral' | 'outline' | 'success'> = {
  trial: 'neutral',
  basic: 'outline',
  pro: 'success',
}

export default async function ClubsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: dbUser } = await admin.from('users').select('role').eq('id', user.id).single()
  if (dbUser?.role !== 'super_admin') redirect('/dashboard')

  const [{ data: clubs }, { data: userCounts }] = await Promise.all([
    admin.from('clubs').select('id, name, slug, plan, is_active, created_at').order('created_at', { ascending: false }),
    admin.from('users').select('club_id').not('club_id', 'is', null),
  ])

  const countMap: Record<string, number> = {}
  userCounts?.forEach((u: any) => {
    countMap[u.club_id] = (countMap[u.club_id] ?? 0) + 1
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clubes"
        description={`${clubs?.length ?? 0} clubes registrados`}
        actions={
          <Link href="/dashboard/clubs/new" className={buttonVariants({ className: 'w-full sm:w-auto' })}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo club
          </Link>
        }
      />

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              <th scope="col" className="px-4 py-3 text-left text-meta font-medium text-ink-3 sm:px-5">Club</th>
              <th scope="col" className="px-4 py-3 text-left text-meta font-medium text-ink-3">Slug</th>
              <th scope="col" className="px-4 py-3 text-left text-meta font-medium text-ink-3">Plan</th>
              <th scope="col" className="px-4 py-3 text-left text-meta font-medium text-ink-3">Usuarios</th>
              <th scope="col" className="px-4 py-3 text-left text-meta font-medium text-ink-3">Estado</th>
              <th scope="col" className="px-4 py-3 text-left text-meta font-medium text-ink-3">Alta</th>
              <th scope="col" className="px-4 py-3 sm:pr-5"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!clubs?.length && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-body text-ink-2">
                  Todavía no hay clubes. Crea el primero con el botón de arriba.
                </td>
              </tr>
            )}
            {clubs?.map((club: any) => (
              <tr key={club.id}>
                <td className="px-4 py-3 text-body font-medium text-ink sm:px-5">{club.name}</td>
                <td className="px-4 py-3 font-mono text-meta text-ink-2">{club.slug}</td>
                <td className="px-4 py-3">
                  <Badge tone={planTone[club.plan] ?? 'neutral'}>{planLabel[club.plan] ?? club.plan}</Badge>
                </td>
                <td className="px-4 py-3 text-body tabular-nums text-ink-2">{countMap[club.id] ?? 0}</td>
                <td className="px-4 py-3">
                  <Badge tone={club.is_active ? 'success' : 'danger'}>
                    {club.is_active ? <CircleCheck className="h-3.5 w-3.5" aria-hidden /> : <CircleX className="h-3.5 w-3.5" aria-hidden />}
                    {club.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-body tabular-nums text-ink-2">{formatDate(club.created_at)}</td>
                <td className="px-4 py-3 sm:pr-5">
                  <div className="flex items-center gap-2">
                    <ClubManageButton clubId={club.id} />
                    <Link href={`/dashboard/clubs/${club.id}/edit`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
