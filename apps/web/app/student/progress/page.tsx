import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getClubFeatures } from '@/lib/get-club-features'
import { Check, Circle, CircleCheck, Target } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/badge'

export default async function StudentProgressPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = getAdminClient()
  const { data: progressProfile } = await admin.from('users').select('club_id').eq('id', user.id).single()
  const features = await getClubFeatures((progressProfile as any)?.club_id)
  if (!features.enable_objectives) redirect('/student')

  const { data: checklists } = await admin
    .from('student_checklists')
    .select('id, title, created_at, completed_at, items:checklist_items(id, text, sort_order, completed_at)')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  const list = (checklists ?? []).map((c: any) => ({
    ...c,
    items: [...(c.items ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order),
  }))

  const totalItems = list.reduce((acc, c) => acc + c.items.length, 0)
  const totalDone = list.reduce((acc, c) => acc + c.items.filter((i: any) => i.completed_at).length, 0)
  const globalPct = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="Mi progreso" description="Los objetivos que tu monitor ha marcado para ti." />

      {list.length > 0 && totalItems > 0 && (
        <Card className="p-4 sm:p-6">
          <p className="text-meta text-ink-3">Objetivos conseguidos</p>
          <p className="mt-1 font-display text-display tabular-nums text-ink">
            {globalPct}<span className="text-title text-ink-3">%</span>
          </p>
          <p className="mt-0.5 text-meta tabular-nums text-ink-3">{totalDone} de {totalItems} objetivos</p>
          <div
            role="progressbar"
            aria-label="Progreso global"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={globalPct}
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/[0.07]"
          >
            <div className="h-2 rounded-full bg-accent-ink" style={{ width: `${globalPct}%` }} />
          </div>
        </Card>
      )}

      {list.length === 0 && (
        <Card>
          <EmptyState
            icon={<Target />}
            title="Todavía no tienes objetivos"
            description="Tu monitor todavía no ha asignado objetivos. Aparecerán aquí cuando los añada."
          />
        </Card>
      )}

      <div className="space-y-4">
        {list.map((checklist: any) => {
          const done = checklist.items.filter((i: any) => i.completed_at).length
          const total = checklist.items.length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          const isCompleted = !!(checklist as any).completed_at
          const allDone = isCompleted || (total > 0 && done === total)

          return (
            <Card key={checklist.id} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <h2 className="min-w-0 text-heading text-ink">{checklist.title}</h2>
                <div className="flex shrink-0 items-center gap-2">
                  {allDone && (
                    <Badge tone="success">
                      <CircleCheck className="h-3.5 w-3.5" aria-hidden />
                      Completado
                    </Badge>
                  )}
                  {total > 0 && (
                    <span className="text-label tabular-nums text-ink-2">{done}/{total}</span>
                  )}
                </div>
              </div>

              {total > 0 && (
                <div
                  role="progressbar"
                  aria-label={`Progreso de ${checklist.title}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  className="h-1 w-full bg-ink/[0.07]"
                >
                  <div className="h-1 bg-accent-ink" style={{ width: `${pct}%` }} />
                </div>
              )}

              <ul className="space-y-3 px-4 py-4 sm:px-5">
                {checklist.items.map((item: any) => (
                  <li key={item.id} className="flex items-start gap-3">
                    {item.completed_at ? (
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent-ink" aria-label="Conseguido" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" aria-label="Pendiente" />
                    )}
                    <span className={`text-body ${item.completed_at ? 'text-ink-3 line-through' : 'text-ink'}`}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
