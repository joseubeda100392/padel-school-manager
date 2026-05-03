'use client'

import { useRouter } from 'next/navigation'

export default function ScheduleViewToggle({ current }: { current: 'list' | 'week' }) {
  const router = useRouter()
  return (
    <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      <button
        onClick={() => router.push('/dashboard/schedule?view=list')}
        className={`px-4 py-2 text-sm font-medium transition-colors ${current === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
      >
        Lista
      </button>
      <button
        onClick={() => router.push('/dashboard/schedule?view=week')}
        className={`px-4 py-2 text-sm font-medium transition-colors ${current === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
      >
        Semana
      </button>
    </div>
  )
}
