'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Level {
  id: string
  name: string
  color: string
}

interface Props {
  studentId: string
  currentLevelId: string | null
  levels: Level[]
}

export function StudentLevelForm({ studentId, currentLevelId, levels }: Props) {
  const [selected, setSelected] = useState(currentLevelId ?? '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await Promise.all([
      supabase.from('users').update({ current_level_id: selected || null }).eq('id', studentId),
      selected
        ? supabase.from('user_levels').insert({
            user_id: studentId,
            level_id: selected,
            assigned_by: user?.id,
          })
        : Promise.resolve(),
    ])

    setSaving(false)
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }

  return (
    <div className="space-y-3">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
      >
        <option value="">Sin nivel asignado</option>
        {levels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={saving || selected === (currentLevelId ?? '')}
        className="w-full rounded-lg bg-green-600 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
      >
        {saving ? 'Guardando...' : done ? '¡Guardado!' : 'Guardar nivel'}
      </button>
    </div>
  )
}
