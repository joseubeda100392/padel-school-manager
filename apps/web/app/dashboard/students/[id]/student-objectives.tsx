'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Circle, CircleCheck, Plus, Trash2, X } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useConfirm } from '@/components/ui/confirm'

type ChecklistItem = {
  id: string
  text: string
  sort_order: number
  completed_at: string | null
  completed_by_id: string | null
}

type Checklist = {
  id: string
  title: string
  created_at: string
  completed_at: string | null
  items: ChecklistItem[]
}

export function StudentObjectives({
  studentId,
  initialChecklists,
}: {
  studentId: string
  initialChecklists: Checklist[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [checklists, setChecklists] = useState<Checklist[]>(initialChecklists)
  const [newTitle, setNewTitle] = useState('')
  const [creatingChecklist, setCreatingChecklist] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [deletingChecklist, setDeletingChecklist] = useState<string | null>(null)
  const [togglingChecklist, setTogglingChecklist] = useState<string | null>(null)
  const [togglingItem, setTogglingItem] = useState<string | null>(null)
  const [deletingItem, setDeletingItem] = useState<string | null>(null)
  const [newItemText, setNewItemText] = useState<Record<string, string>>({})
  const [addingItem, setAddingItem] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  async function handleCreateChecklist(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreatingChecklist(true)
    const res = await fetch('/api/student-checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, title: newTitle.trim() }),
    })
    const json = await res.json()
    if (json.data) {
      setChecklists(prev => [{ ...json.data, items: [] }, ...prev])
      setNewTitle('')
      setShowForm(false)
      router.refresh()
    }
    setCreatingChecklist(false)
  }

  async function handleToggleChecklist(checklistId: string, currentlyCompleted: boolean) {
    setTogglingChecklist(checklistId)
    const res = await fetch(`/api/student-checklists/${checklistId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !currentlyCompleted }),
    })
    const json = await res.json()
    if (json.data) {
      setChecklists(prev => prev.map(c =>
        c.id !== checklistId ? c : { ...c, completed_at: json.data.completed_at }
      ))
      router.refresh()
    }
    setTogglingChecklist(null)
  }

  async function handleDeleteChecklist(checklistId: string) {
    const ok = await confirm({
      title: '¿Eliminar este objetivo?',
      description: 'Se borrarán también todos sus sub-objetivos y el progreso del alumno. No se puede deshacer.',
      confirmLabel: 'Eliminar objetivo',
      destructive: true,
    })
    if (!ok) return
    setDeletingChecklist(checklistId)
    await fetch(`/api/student-checklists/${checklistId}`, { method: 'DELETE' })
    setChecklists(prev => prev.filter(c => c.id !== checklistId))
    setDeletingChecklist(null)
    router.refresh()
  }

  async function handleToggleItem(checklistId: string, itemId: string, currentlyCompleted: boolean) {
    setTogglingItem(itemId)
    const res = await fetch(`/api/checklist-items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !currentlyCompleted }),
    })
    const json = await res.json()
    if (json.data) {
      setChecklists(prev => prev.map(c =>
        c.id !== checklistId ? c : {
          ...c,
          items: c.items.map(it =>
            it.id !== itemId ? it : { ...it, completed_at: json.data.completed_at, completed_by_id: json.data.completed_by_id }
          ),
        }
      ))
      router.refresh()
    }
    setTogglingItem(null)
  }

  async function handleDeleteItem(checklistId: string, itemId: string) {
    setDeletingItem(itemId)
    await fetch(`/api/checklist-items/${itemId}`, { method: 'DELETE' })
    setChecklists(prev => prev.map(c =>
      c.id !== checklistId ? c : { ...c, items: c.items.filter(it => it.id !== itemId) }
    ))
    setDeletingItem(null)
    router.refresh()
  }

  async function handleAddItem(e: React.FormEvent, checklistId: string) {
    e.preventDefault()
    const text = (newItemText[checklistId] ?? '').trim()
    if (!text) return
    setAddingItem(checklistId)
    const res = await fetch('/api/checklist-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklistId, text }),
    })
    const json = await res.json()
    if (json.data) {
      setChecklists(prev => prev.map(c =>
        c.id !== checklistId ? c : { ...c, items: [...c.items, json.data] }
      ))
      setNewItemText(prev => ({ ...prev, [checklistId]: '' }))
      router.refresh()
    }
    setAddingItem(null)
  }

  const completedCount = (items: ChecklistItem[]) => items.filter(i => i.completed_at).length

  return (
    <Card>
      <CardHeader
        title="Objetivos y progreso"
        action={
          !showForm ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setShowForm(true); setTimeout(() => titleInputRef.current?.focus(), 50) }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo checklist
            </Button>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        {showForm && (
          <form onSubmit={handleCreateChecklist} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Nombre del objetivo" className="flex-1">
              <Input
                ref={titleInputRef}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Por ejemplo: mejora tu bandeja"
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" loading={creatingChecklist} disabled={!newTitle.trim()}>
                Crear objetivo
              </Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); setNewTitle('') }}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {checklists.length === 0 && !showForm && (
          <p className="text-body text-ink-3">Sin objetivos todavía. Crea uno para empezar.</p>
        )}

        <div className="space-y-4">
          {checklists.map(checklist => {
            const done = completedCount(checklist.items)
            const total = checklist.items.length
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const isCompleted = !!checklist.completed_at

            return (
              <div key={checklist.id} className={`rounded-control border p-3 sm:p-4 ${isCompleted ? 'border-accent/30 bg-accent-soft' : 'border-line bg-surface-2'}`}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleChecklist(checklist.id, isCompleted)}
                    disabled={togglingChecklist === checklist.id}
                    aria-pressed={isCompleted}
                    aria-label={isCompleted ? `Marcar "${checklist.title}" como pendiente` : `Marcar "${checklist.title}" como superado`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control disabled:opacity-40"
                  >
                    {isCompleted ? (
                      <CircleCheck className="h-6 w-6 text-accent-ink" aria-hidden />
                    ) : (
                      <Circle className="h-6 w-6 text-ink-3" aria-hidden />
                    )}
                  </button>

                  <span className={`min-w-0 flex-1 truncate text-label ${isCompleted ? 'text-accent-ink line-through' : 'text-ink'}`}>
                    {checklist.title}
                  </span>

                  {total > 0 && (
                    <span className="shrink-0 text-meta tabular-nums text-ink-3">{done}/{total}</span>
                  )}

                  <Button
                    size="icon"
                    variant="danger-ghost"
                    onClick={() => handleDeleteChecklist(checklist.id)}
                    disabled={deletingChecklist === checklist.id}
                    aria-label={`Eliminar el objetivo "${checklist.title}"`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>

                {total > 0 && (
                  <div
                    role="progressbar"
                    aria-label={`Progreso de ${checklist.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    className="mb-3 ml-12 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]"
                  >
                    <div className="h-1.5 rounded-full bg-accent-ink" style={{ width: `${pct}%` }} />
                  </div>
                )}

                {checklist.items.length > 0 && (
                  <ul className="mb-3 ml-4 sm:ml-12">
                    {[...checklist.items].sort((a, b) => a.sort_order - b.sort_order).map(item => (
                      <li key={item.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleItem(checklist.id, item.id, !!item.completed_at)}
                          disabled={togglingItem === item.id}
                          aria-pressed={!!item.completed_at}
                          aria-label={item.completed_at ? `Marcar "${item.text}" como pendiente` : `Marcar "${item.text}" como hecho`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-40"
                        >
                          {item.completed_at ? (
                            <CircleCheck className="h-5 w-5 text-accent-ink" aria-hidden />
                          ) : (
                            <Circle className="h-5 w-5 text-ink-3" aria-hidden />
                          )}
                        </button>
                        <span className={`min-w-0 flex-1 text-body ${item.completed_at ? 'text-ink-3 line-through' : 'text-ink'}`}>
                          {item.text}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteItem(checklist.id, item.id)}
                          disabled={deletingItem === item.id}
                          aria-label={`Quitar "${item.text}"`}
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <form onSubmit={e => handleAddItem(e, checklist.id)} className="flex gap-2 sm:ml-12">
                  <div className="flex-1">
                    <label htmlFor={`new-item-${checklist.id}`} className="sr-only">Nuevo sub-objetivo de {checklist.title}</label>
                    <Input
                      id={`new-item-${checklist.id}`}
                      value={newItemText[checklist.id] ?? ''}
                      onChange={e => setNewItemText(prev => ({ ...prev, [checklist.id]: e.target.value }))}
                      placeholder="Añadir sub-objetivo"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    loading={addingItem === checklist.id}
                    disabled={!(newItemText[checklist.id] ?? '').trim()}
                  >
                    Añadir
                  </Button>
                </form>
              </div>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}
