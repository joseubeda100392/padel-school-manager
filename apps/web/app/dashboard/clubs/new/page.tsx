'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function NewClubPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [plan, setPlan] = useState<'trial' | 'basic' | 'pro'>('trial')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleNameChange(value: string) {
    setName(value)
    setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .insert({ name, slug, plan, is_active: true })
      .select()
      .single()

    if (clubError) {
      setError(clubError.message)
      setLoading(false)
      return
    }

    if (adminEmail && adminName) {
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!'
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail,
          name: adminName,
          role: 'admin',
          tempPassword,
          clubIdOverride: club.id,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(`Club creado pero error al crear admin: ${json.error}`)
        setLoading(false)
        return
      }
    }

    window.location.href = '/dashboard/clubs'
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <a href="/dashboard/clubs" className="text-sm text-gray-500 hover:text-gray-700">← Clubes</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo club</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre del club *</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Club Pádel Madrid"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Slug (URL)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="club-padel-madrid"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as any)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="trial">Trial</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </select>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="mb-3 text-sm font-medium text-gray-700">Admin del club (opcional)</p>
          <div className="space-y-3">
            <input
              type="text"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Nombre del administrador"
            />
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="admin@club.com"
            />
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <a
            href="/dashboard/clubs"
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? 'Creando...' : 'Crear club'}
          </button>
        </div>
      </form>
    </div>
  )
}
