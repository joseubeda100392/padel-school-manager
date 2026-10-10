'use client'

import { useRouter } from 'next/navigation'

const OPTIONS: { value: 'list' | 'week'; label: string }[] = [
  { value: 'list', label: 'Lista' },
  { value: 'week', label: 'Semana' },
]

export default function ScheduleViewToggle({ current }: { current: 'list' | 'week' }) {
  const router = useRouter()
  return (
    <div role="group" aria-label="Vista del horario" className="flex rounded-control border border-line-strong/60 bg-surface-2 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={current === o.value}
          onClick={() => router.push(`/dashboard/schedule?view=${o.value}`)}
          className={`h-10 rounded-[8px] px-4 text-label transition-colors ${
            current === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
