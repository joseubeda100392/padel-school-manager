'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { createClient } from '@/lib/supabase/client'

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']

export default function NewLevelPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [order, setOrder] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { data: userData } = await supabase.from('users').select('club_id').eq('id', user!.id).single()
    const { error: err } = await supabase.from('levels').insert({ name, description, color, order, club_id: userData?.club_id ?? null })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    window.location.href = '/dashboard/levels'
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <PageHeader back={{ href: '/dashboard/levels', label: 'Niveles' }} title="Nuevo nivel" />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-6">
          <Field label="Nombre">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Por ejemplo, Iniciación"
            />
          </Field>

          <Field label="Descripción (opcional)">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Qué sabe hacer un alumno de este nivel"
            />
          </Field>

          <Field label="Posición en la lista" className="sm:w-40">
            <Input
              type="text"
              inputMode="numeric"
              min={1}
              value={order}
              onFocus={e => e.target.select()}
              onChange={(e) => setOrder(Number(e.target.value))}
              className="tabular-nums"
            />
          </Field>

          <div role="group" aria-labelledby="color-nivel" className="space-y-2">
            <p id="color-nivel" className="text-label text-ink">Color</p>
            <div className="flex flex-wrap gap-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className="h-11 w-11 rounded-full ring-1 ring-ink/10 transition-transform active:scale-95"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link href="/dashboard/levels" className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
              Cancelar
            </Link>
            <Button type="submit" loading={loading} className="w-full sm:w-auto">
              {loading ? 'Creando nivel…' : 'Crear nivel'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
