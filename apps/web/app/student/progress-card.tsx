import Link from 'next/link'
import { Circle, CircleCheck, Trophy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { formatRelativeDay } from '@/lib/format-date'

type Item = { id: string; text: string; sort_order: number; completed_at: string | null }
export type ProgressChecklist = { id: string; title: string; created_at: string; completed_at: string | null; items: Item[] }

const PENDING_SHOWN = 3

// Resumen de objetivos en la portada: la lista en curso (la más reciente sin
// cerrar), cuánto lleva, qué le toca trabajar y su último logro. Sin listas no
// se pinta nada: la portada no enseña vacíos.
export function ProgressCard({ checklists }: { checklists: ProgressChecklist[] }) {
  const withItems = checklists.filter((c) => c.items.length > 0)
  if (withItems.length === 0) return null

  const byNewest = [...withItems].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const active = byNewest.find((c) => !c.completed_at && c.items.some((i) => !i.completed_at)) ?? byNewest[0]
  const items = [...active.items].sort((a, b) => a.sort_order - b.sort_order)
  const done = items.filter((i) => i.completed_at).length
  const pct = Math.round((done / items.length) * 100)
  const pending = items.filter((i) => !i.completed_at)

  const lastAchieved = withItems
    .flatMap((c) => c.items)
    .filter((i): i is Item & { completed_at: string } => !!i.completed_at)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0]

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 className="text-heading text-ink">Tu progreso</h2>
          <p className="mt-0.5 text-meta text-ink-3">{active.title}</p>
        </div>
        <Link href="/student/progress" className={buttonVariants({ variant: 'link', size: 'sm' })}>Ver todo</Link>
      </div>

      <div className="px-4 pt-4 sm:px-5">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-title tabular-nums text-ink">{done} de {items.length}</span>
          <span className="text-meta text-ink-3">{done === items.length ? 'objetivos conseguidos: ¡lista completa!' : 'objetivos conseguidos'}</span>
        </p>
        <div
          role="progressbar"
          aria-label="Objetivos conseguidos"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done}
          aria-valuetext={`${done} de ${items.length}`}
          className="mt-2.5 flex h-2 gap-1"
        >
          {items.map((i) => (
            <span key={i.id} className={`h-2 flex-1 rounded-full ${i.completed_at ? 'bg-accent-ink' : 'bg-ink/[0.08]'}`} />
          ))}
        </div>
        <p className="sr-only">{pct}%</p>
      </div>

      {pending.length > 0 && (
        <div className="px-4 pb-1 pt-4 sm:px-5">
          <p className="text-meta font-medium text-ink-3">Lo siguiente que trabajar</p>
          <ul className="mt-1.5">
            {pending.slice(0, PENDING_SHOWN).map((i) => (
              <li key={i.id} className="flex items-start gap-2.5 py-1.5 text-body text-ink">
                <Circle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink-3" aria-hidden />
                <span>{i.text}</span>
              </li>
            ))}
          </ul>
          {pending.length > PENDING_SHOWN && (
            <p className="pb-1 text-meta text-ink-3">Y {pending.length - PENDING_SHOWN} más</p>
          )}
        </div>
      )}

      {lastAchieved && (
        <div className="mt-3 flex items-start gap-2.5 border-t border-line bg-accent-soft/50 px-4 py-3 sm:px-5">
          <span aria-hidden className="mt-0.5 text-accent-ink">
            {done === items.length ? <Trophy className="h-[18px] w-[18px]" /> : <CircleCheck className="h-[18px] w-[18px]" />}
          </span>
          <p className="text-body text-ink-2">
            <span className="font-medium text-ink">Último conseguido:</span> {lastAchieved.text}
            <span className="text-ink-3"> · {formatRelativeDay(lastAchieved.completed_at)}</span>
          </p>
        </div>
      )}
    </Card>
  )
}
