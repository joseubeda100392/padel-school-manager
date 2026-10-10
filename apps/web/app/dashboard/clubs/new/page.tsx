'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Button, buttonVariants } from '@/components/ui/button'

const DEFAULT_PASSWORD = 'miclave123'

export default function NewClubPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [plan, setPlan] = useState<'trial' | 'basic' | 'pro'>('trial')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminPassword, setAdminPassword] = useState(DEFAULT_PASSWORD)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

  function slugify(value: string): string {
    return value
      .normalize('NFD').replace(COMBINING_DIACRITICS, '') // quita acentos: á→a, ñ→n, etc.
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function handleNameChange(value: string) {
    setName(value)
    setSlug(slugify(value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    let { data: club, error: clubError } = await supabase
      .from('clubs')
      .insert({ name, slug, plan, is_active: true })
      .select()
      .single()

    // Si el slug ya existe y es del mismo club (reintento tras un fallo
    // parcial anterior, ej. el admin no se llegó a crear), se reutiliza en
    // vez de bloquear el formulario entero por un choque de slug.
    if (clubError?.code === '23505' && clubError.message.includes('clubs_slug_key')) {
      const { data: existing } = await supabase
        .from('clubs')
        .select('*')
        .eq('slug', slug)
        .single()
      if (existing && existing.name.toLowerCase().trim() === name.toLowerCase().trim()) {
        club = existing
        clubError = null
      }
    }

    if (clubError || !club) {
      setError(clubError?.message ?? 'Error al crear el club')
      setLoading(false)
      return
    }

    if (adminEmail && adminName) {
      const tempPassword = adminPassword.trim() || DEFAULT_PASSWORD
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
    <div className="mx-auto w-full max-w-xl space-y-6">
      <PageHeader title="Nuevo club" back={{ href: '/dashboard/clubs', label: 'Clubes' }} />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Nombre del club">
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                autoComplete="organization"
                placeholder="Club Pádel Madrid"
              />
            </Field>

            <Field label="Slug (URL)">
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                autoCapitalize="none"
                className="font-mono"
                placeholder="club-padel-madrid"
              />
            </Field>

            <Field label="Plan">
              <Select value={plan} onChange={(e) => setPlan(e.target.value as any)}>
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </Select>
            </Field>

            <fieldset className="space-y-3 border-t border-line pt-4">
              <legend className="text-label text-ink">Admin del club (opcional)</legend>
              <Field label="Nombre del administrador">
                <Input type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Email del administrador">
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  autoComplete="off"
                  inputMode="email"
                  placeholder="admin@club.com"
                />
              </Field>
              <Field label="Contraseña inicial" hint="Compártesela al admin. Podrá cambiarla luego desde su perfil.">
                <Input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} minLength={6} autoComplete="off" />
              </Field>
            </fieldset>

            {error && <p role="alert" className="text-meta font-medium text-danger-ink">{error}</p>}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link href="/dashboard/clubs" className={buttonVariants({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
                Cancelar
              </Link>
              <Button type="submit" loading={loading} className="w-full sm:w-auto">
                {loading ? 'Creando…' : 'Crear club'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
