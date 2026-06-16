export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { ClubManageButton } from '@/components/clubs/club-manage-button'

const planLabel: Record<string, string> = {
  trial: 'Trial',
  basic: 'Basic',
  pro: 'Pro',
}

const planBadge: Record<string, string> = {
  trial: 'bg-gray-100 text-gray-600',
  basic: 'bg-blue-100 text-blue-700',
  pro: 'bg-brand-100 text-brand-700',
}

export default async function ClubsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user?.user_metadata?.role !== 'super_admin') redirect('/dashboard')

  const admin = getAdminClient()

  const [{ data: clubs }, { data: userCounts }] = await Promise.all([
    admin.from('clubs').select('id, name, slug, plan, is_active, created_at').order('created_at', { ascending: false }),
    admin.from('users').select('club_id').not('club_id', 'is', null),
  ])

  const countMap: Record<string, number> = {}
  userCounts?.forEach((u: any) => {
    countMap[u.club_id] = (countMap[u.club_id] ?? 0) + 1
  })

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Clubes</h1>
          <p className="mt-1 text-sm text-gray-500">{clubs?.length ?? 0} clubes registrados</p>
        </div>
        <a
          href="/dashboard/clubs/new"
          className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          + Nuevo club
        </a>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Club</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Slug</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Usuarios</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Alta</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!clubs?.length && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  No hay clubes aún.
                </td>
              </tr>
            )}
            {clubs?.map((club: any) => (
              <tr key={club.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{club.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{club.slug}</td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${planBadge[club.plan] ?? 'bg-gray-100 text-gray-500'}`}>
                    {planLabel[club.plan] ?? club.plan}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{countMap[club.id] ?? 0}</td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${club.is_active ? 'bg-brand-100 text-brand-700' : 'bg-red-100 text-red-600'}`}>
                    {club.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{formatDate(club.created_at)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <ClubManageButton clubId={club.id} />
                    <a
                      href={`/dashboard/clubs/${club.id}/edit`}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Editar
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
