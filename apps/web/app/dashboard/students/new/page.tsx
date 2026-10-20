'use client'

import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardBody } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Notice } from '@/components/ui/feedback'

const DEFAULT_PASSWORD = 'miclave123'

export default function NewStudentPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'student' | 'coach' | 'admin'>('student')
  const [levelId, setLevelId] = useState('')
  const [levels, setLevels] = useState<any[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [tempPassword, setTempPassword] = useState(DEFAULT_PASSWORD)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/levels').then(r => r.json()),
      fetch('/api/admin/club-features').then(r => r.json()),
    ]).then(([levelsData, featData]) => {
      if (levelsData.levels) setLevels(levelsData.levels)
      if (featData.isSuperAdmin) setIsSuperAdmin(true)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, phone: phone.trim() || null, role, levelId: levelId || null, tempPassword }),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.error || 'Error creando usuario')
      setLoading(false)
      return
    }

    toast.success('Usuario creado correctamente')
    window.location.href = '/dashboard/students'
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <PageHeader title="Nuevo usuario" back={{ href: '/dashboard/students', label: 'Usuarios' }} />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Nombre completo">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="off"
                placeholder="Juan García"
              />
            </Field>

            <Field label="Email">
              <Input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="juan@email.com"
              />
            </Field>

            <Field label="Teléfono (opcional)">
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="600 000 000"
              />
            </Field>

            <Field label="Contraseña inicial" hint="Compártesela al usuario: podrá cambiarla luego desde su perfil.">
              <Input
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="off"
                placeholder="Mínimo 6 caracteres"
              />
            </Field>

            <Field label="Rol">
              <Select value={role} onChange={(e) => setRole(e.target.value as 'student' | 'coach' | 'admin')}>
                <option value="student">Alumno</option>
                <option value="coach">Monitor</option>
                {isSuperAdmin && <option value="admin">Admin</option>}
              </Select>
            </Field>

            {role === 'student' &&
              (levels.length === 0 ? (
                <Notice tone="warn">
                  Este club no tiene niveles creados.{' '}
                  <Link href="/dashboard/levels/new" className="font-medium underline">
                    Crea los niveles primero
                  </Link>{' '}
                  para poder asignar uno al alumno.
                </Notice>
              ) : (
                <Field label="Nivel inicial">
                  <Select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                    <option value="">Sin asignar</option>
                    {levels.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </Select>
                </Field>
              ))}

            {error && <Notice tone="danger">{error}</Notice>}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
              <Link href="/dashboard/students" className={buttonVariants({ variant: 'secondary', className: 'sm:flex-1' })}>
                Cancelar
              </Link>
              <Button type="submit" loading={loading} className="sm:flex-1">
                {loading ? 'Creando usuario' : 'Crear usuario'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
