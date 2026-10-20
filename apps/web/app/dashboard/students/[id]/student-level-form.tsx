'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/field'

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
      <Field label="Cambiar nivel">
        <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Sin nivel asignado</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button onClick={save} loading={saving} disabled={selected === (currentLevelId ?? '')} block>
        {done && <Check className="h-4 w-4" aria-hidden />}
        {saving ? 'Guardando nivel' : done ? 'Nivel guardado' : 'Guardar nivel'}
      </Button>
    </div>
  )
}
