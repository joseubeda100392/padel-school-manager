'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { useConfirm } from '@/components/ui/confirm'
import type { NetworkCoordinator } from '@/lib/network'

interface Candidate { id: string; name: string; email: string; clubName: string }

// Solo para el super admin: quién coordina la red, añadir (alguien que ya es
// admin de una sede o una persona nueva que solo coordina) y quitar.
export function CoordinatorsPanel({ networkId, networkName, coordinators, candidates }: {
  networkId: string
  networkName: string
  coordinators: NetworkCoordinator[]
  candidates: Candidate[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [mode, setMode] = useState<'closed' | 'existing' | 'new'>('closed')
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)

  async function call(method: 'POST' | 'DELETE', body: object) {
    setBusy(true)
    const res = await fetch(`/api/superadmin/networks/${networkId}/coordinators`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    const json = await res?.json().catch(() => ({}))
    setBusy(false)
    if (!res?.ok) {
      toast.error(json?.error ?? 'No se ha podido guardar')
      return false
    }
    router.refresh()
    return true
  }

  async function add() {
    const ok = mode === 'existing'
      ? await call('POST', { userId })
      : await call('POST', { name: form.name, email: form.email, password: form.password })
    if (!ok) return
    toast.success(mode === 'new' ? 'Coordinador creado. Pásale su email y su contraseña.' : 'Coordinador añadido')
    setMode('closed'); setUserId(''); setForm({ name: '', email: '', password: '' })
  }

  async function remove(c: NetworkCoordinator) {
    const ok = await confirm({
      title: `Quitar a ${c.name} de coordinador`,
      description: c.onlyCoordinator
        ? 'Solo coordinaba la red: su cuenta se desactiva y ya no podrá entrar.'
        : 'Deja de poder entrar en las demás sedes y vuelve a ser solo admin de la suya.',
      confirmLabel: 'Quitar',
      destructive: true,
    })
    if (ok && (await call('DELETE', { userId: c.userId }))) toast.success('Coordinador quitado')
  }

  return (
    <Card>
      <CardHeader
        title="Coordinadores"
        description={`Pueden entrar en todas las sedes de la red ${networkName} y gestionarlas como su admin. Solo tú los nombras.`}
        action={mode === 'closed' && (
          <Button size="sm" onClick={() => setMode(candidates.length ? 'existing' : 'new')}>Añadir coordinador</Button>
        )}
      />
      <CardBody className="space-y-4">
        {coordinators.length === 0 ? (
          <p className="text-body text-ink-3">Esta red todavía no tiene coordinadores.</p>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {coordinators.map(c => (
              <li key={c.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-label text-ink">{c.name}</p>
                  <p className="truncate text-meta text-ink-3">{c.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{c.onlyCoordinator ? 'Solo coordina' : 'También admin de su sede'}</Badge>
                  <Button variant="danger-ghost" size="sm" onClick={() => remove(c)} disabled={busy}>Quitar</Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {mode !== 'closed' && (
          <div className="space-y-4 rounded-control border border-line bg-surface-2 p-4">
            <div role="radiogroup" aria-label="Quién va a coordinar" className="flex flex-wrap gap-2">
              <Button variant={mode === 'existing' ? 'primary' : 'secondary'} size="sm" role="radio" aria-checked={mode === 'existing'} onClick={() => setMode('existing')} disabled={!candidates.length}>
                Un admin de la red
              </Button>
              <Button variant={mode === 'new' ? 'primary' : 'secondary'} size="sm" role="radio" aria-checked={mode === 'new'} onClick={() => setMode('new')}>
                Persona nueva
              </Button>
            </div>

            {mode === 'existing' ? (
              <Field label="Admin de una sede" hint="Sigue siendo admin de su sede y además podrá entrar en las demás.">
                <Select value={userId} onChange={e => setUserId(e.target.value)}>
                  <option value="">Elige un admin</option>
                  {candidates.map(c => <option key={c.id} value={c.id}>{c.name} · {c.clubName}</option>)}
                </Select>
              </Field>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Nombre">
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoComplete="off" />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} autoComplete="off" />
                </Field>
                <Field label="Contraseña inicial" hint="Podrá cambiarla al entrar.">
                  <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} minLength={6} autoComplete="off" />
                </Field>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={add}
                loading={busy}
                disabled={mode === 'existing' ? !userId : form.name.trim().length < 2 || !form.email.includes('@') || form.password.length < 6}
                className="w-full sm:w-auto"
              >
                {mode === 'existing' ? 'Hacer coordinador' : 'Crear coordinador'}
              </Button>
              <Button variant="secondary" onClick={() => setMode('closed')} className="w-full sm:w-auto">Cancelar</Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
