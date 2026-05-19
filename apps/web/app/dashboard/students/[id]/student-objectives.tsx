'use client'

import { useState, useRef } from 'react'

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
  items: ChecklistItem[]
}

export function StudentObjectives({
  studentId,
  initialChecklists,
}: {
  studentId: string
  initialChecklists: Checklist[]
}) {
  const [checklists, setChecklists] = useState<Checklist[]>(initialChecklists)
  const [newTitle, setNewTitle] = useState('')
  const [creatingChecklist, setCreatingChecklist] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [deletingChecklist, setDeletingChecklist] = useState<string | null>(null)
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
    }
    setCreatingChecklist(false)
  }

  async function handleDeleteChecklist(checklistId: string) {
    if (!confirm('¿Eliminar este checklist y todos sus objetivos?')) return
    setDeletingChecklist(checklistId)
    await fetch(`/api/student-checklists/${checklistId}`, { method: 'DELETE' })
    setChecklists(prev => prev.filter(c => c.id !== checklistId))
    setDeletingChecklist(null)
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
    }
    setAddingItem(null)
  }

  const completedCount = (items: ChecklistItem[]) => items.filter(i => i.completed_at).length

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900">Objetivos y progreso</h2>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setTimeout(() => titleInputRef.current?.focus(), 50) }}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            + Nuevo checklist
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreateChecklist} className="mb-4 flex gap-2">
          <input
            ref={titleInputRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Título del checklist (ej. Técnica de revés)"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button
            type="submit"
            disabled={creatingChecklist || !newTitle.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {creatingChecklist ? '...' : 'Crear'}
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(false); setNewTitle('') }}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancelar
          </button>
        </form>
      )}

      {checklists.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">Sin objetivos todavía. Crea un checklist para empezar.</p>
      )}

      <div className="space-y-4">
        {checklists.map(checklist => {
          const done = completedCount(checklist.items)
          const total = checklist.items.length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0

          return (
            <div key={checklist.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-gray-900 truncate">{checklist.title}</span>
                  {total > 0 && (
                    <span className="shrink-0 text-xs text-gray-400">{done}/{total}</span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteChecklist(checklist.id)}
                  disabled={deletingChecklist === checklist.id}
                  className="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                  title="Eliminar checklist"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {total > 0 && (
                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full bg-green-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {checklist.items.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {[...checklist.items].sort((a, b) => a.sort_order - b.sort_order).map(item => (
                    <li key={item.id} className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleItem(checklist.id, item.id, !!item.completed_at)}
                        disabled={togglingItem === item.id}
                        className="shrink-0 disabled:opacity-40"
                        title={item.completed_at ? 'Marcar como pendiente' : 'Marcar como conseguido'}
                      >
                        {item.completed_at ? (
                          <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-gray-300 hover:text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 1.5a8.25 8.25 0 100 16.5 8.25 8.25 0 000-16.5z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 text-sm ${item.completed_at ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {item.text}
                      </span>
                      <button
                        onClick={() => handleDeleteItem(checklist.id, item.id)}
                        disabled={deletingItem === item.id}
                        className="shrink-0 rounded p-0.5 text-gray-200 hover:text-red-400 disabled:opacity-40"
                        title="Eliminar objetivo"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={e => handleAddItem(e, checklist.id)} className="flex gap-2">
                <input
                  value={newItemText[checklist.id] ?? ''}
                  onChange={e => setNewItemText(prev => ({ ...prev, [checklist.id]: e.target.value }))}
                  placeholder="Añadir objetivo..."
                  className="flex-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  type="submit"
                  disabled={addingItem === checklist.id || !(newItemText[checklist.id] ?? '').trim()}
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40"
                >
                  {addingItem === checklist.id ? '...' : 'Añadir'}
                </button>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}
