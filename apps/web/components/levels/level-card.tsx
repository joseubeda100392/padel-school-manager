import { Users } from 'lucide-react'

interface Props {
  level: { id: string; name: string; description: string | null; color: string; order: number }
  studentCount: number
}

export function LevelCard({ level, studentCount }: Props) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: level.color }}
        />
        <span className="text-xs font-medium text-gray-400">#{level.order}</span>
      </div>

      <h3 className="mb-1 font-semibold text-gray-900">{level.name}</h3>
      {level.description && (
        <p className="mb-4 text-sm text-gray-500 leading-snug">{level.description}</p>
      )}

      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <Users className="h-4 w-4" />
        <span>{studentCount} {studentCount === 1 ? 'alumno' : 'alumnos'}</span>
      </div>

      <a
        href={`/dashboard/levels/${level.id}`}
        className="mt-4 block text-center rounded-lg border border-gray-200 py-1.5 text-sm font-medium text-gray-600 hover:border-brand-500 hover:text-brand-500 transition-colors"
      >
        Editar
      </a>
    </div>
  )
}
