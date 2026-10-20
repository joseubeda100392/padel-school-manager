import { Users } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { LevelTag } from '@/components/ui/badge'
import Link from 'next/link'

interface Props {
  level: { id: string; name: string; description: string | null; color: string; order: number }
  studentCount: number
}

export function LevelCard({ level, studentCount }: Props) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
      <span className="w-8 shrink-0 text-meta tabular-nums text-ink-3">#{level.order}</span>
      <div className="min-w-0 flex-1 basis-48">
        <LevelTag name={level.name} color={level.color} className="text-[0.9375rem] text-ink" />
        {level.description && (
          <p className="mt-0.5 text-meta text-ink-3">{level.description}</p>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-body text-ink-2">
        <Users className="h-4 w-4 text-ink-3" aria-hidden />
        <span className="tabular-nums">{studentCount} {studentCount === 1 ? 'alumno' : 'alumnos'}</span>
      </p>
      <Link href={`/dashboard/levels/${level.id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
        Editar
      </Link>
    </li>
  )
}
