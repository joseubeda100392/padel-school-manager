'use client'

import { useState } from 'react'

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

    const res = await fetch('/api/admin/students/level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: studentId, levelId: selected || null }),
    })

    setSaving(false)
    if (res.ok) {
      setDone(true)
      window.location.reload()
    }
  }

  return (
    <div className="space-y-3">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
        className="w-full rounded-lg bg-brand-500 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
      >
        {saving ? 'Guardando...' : done ? '¡Guardado!' : 'Guardar nivel'}
      </button>
    </div>
  )
}
