'use client'

import { useState } from 'react'
import { Bell, CalendarDays, Home, Package, Zap, MoreHorizontal, CircleAlert, CircleCheck, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, SectionTitle } from '@/components/ui/card'
import { Badge, LevelTag } from '@/components/ui/badge'
import { Field, Input, Select } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'
import { ConfirmProvider, useConfirm } from '@/components/ui/confirm'
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback'
import { DateTile, List, ListRow, Stat } from '@/components/ui/list'
import { AppBar, StickyAction, TabBar } from '@/components/ui/app-chrome'
import { CourtCard } from '@/components/ui/court-card'

const tabs = [
  { href: '/dev/design', label: 'Inicio', icon: Home, exact: true },
  { href: '/dev/design/clases', label: 'Clases', icon: CalendarDays },
  { href: '/dev/design/huecos', label: 'Huecos', icon: Zap, badge: 3 },
  { href: '/dev/design/bolsa', label: 'Bolsa', icon: Package },
  { href: '/dev/design/mas', label: 'Más', icon: MoreHorizontal },
]

export function DesignPreview() {
  return (
    <ConfirmProvider>
      <Preview />
    </ConfirmProvider>
  )
}

function Preview() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [email, setEmail] = useState('')
  const confirm = useConfirm()
  const [lastAnswer, setLastAnswer] = useState<string | null>(null)

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(var(--tabbar-h)+var(--safe-bottom)+5rem)] font-sans text-ink md:pb-16">
      <AppBar title="Sistema de diseño" actions={<Button variant="ghost" size="icon" aria-label="Avisos"><Bell className="h-5 w-5" /></Button>} />

      <main className="mx-auto max-w-[1120px] space-y-10 px-4 py-6 md:px-8 md:py-10">
        <header className="hidden md:block">
          <p className="text-meta text-ink-3">ePadel School · solo desarrollo</p>
          <h1 className="mt-1 font-display text-display text-ink">Sistema de diseño</h1>
        </header>

        <section className="space-y-4">
          <SectionTitle>Firma: próxima clase</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <CourtCard
              eyebrow="Tu próxima clase"
              title="Lunes 12, 10:00"
              meta="Pista 1 · 60 min · Monitor: Álex Ruiz"
              court="Pista 1"
              status={<Badge tone="success" className="bg-accent text-accent-on"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Pagada</Badge>}
              footer={
                <div className="flex flex-wrap items-center justify-between gap-2 text-meta text-chrome-ink-2">
                  <span>3 de 4 plazas ocupadas</span>
                  <button type="button" className="font-medium text-accent hover:underline">No puedo ir</button>
                </div>
              }
            />
            <Card>
              <CardBody className="grid h-full grid-cols-2 content-center gap-4">
                <Stat label="Clases en bolsa" value="2" hint="1 de 60 min · 1 de 90" />
                <Stat label="Cuota de octubre" value="46,00 €" hint="Pagada el 1 oct" />
              </CardBody>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>Botones</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button>Pagar 46,00 €</Button>
            <Button variant="secondary">Ver historial</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button variant="danger">Dar de baja</Button>
            <Button variant="danger-ghost">Quitar falta</Button>
            <Button loading>Guardando</Button>
            <Button disabled>Sin plazas</Button>
            <Button variant="link">Ver normas del club</Button>
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>Estados y niveles</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden />Al día</Badge>
            <Badge tone="warn"><CircleAlert className="h-3.5 w-3.5" aria-hidden />Pendiente octubre</Badge>
            <Badge tone="danger">Impagado</Badge>
            <Badge>Festivo</Badge>
            <Badge tone="outline">4/4 alumnos</Badge>
            <span className="mx-2 h-5 w-px bg-line" aria-hidden />
            <LevelTag name="Iniciación" color="#22c55e" />
            <LevelTag name="Medio" color="#3b82f6" />
            <LevelTag name="Avanzado" color="#a855f7" />
            <LevelTag name="Infantil" color="#ec4899" />
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Notice tone="neutral" icon={<Inbox />}>Tienes 1 clase en la bolsa. Úsala para apuntarte a un hueco libre.</Notice>
            <Notice tone="warn" icon={<CircleAlert />} action={<Button size="sm" variant="secondary">Pagar</Button>}>La cuota de octubre está pendiente.</Notice>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title="Huecos libres esta semana" description="Plazas que han dejado otros alumnos de tu nivel" />
            <List className="mt-3">
              <ListRow leading={<DateTile weekday="Mié" day={14} />} title="19:00 · Pista 2" subtitle="Medio · 1 plaza libre" trailing={<Badge tone="success">1 clase</Badge>} href="#" />
              <ListRow leading={<DateTile weekday="Jue" day={15} />} title="09:00 · Pista 6" subtitle="Medio · 2 plazas libres" trailing={<span className="text-label tabular-nums text-ink">12,00 €</span>} href="#" />
              <ListRow leading={<DateTile weekday="Sáb" day={17} />} title="11:30 · Pista 3" subtitle="Medio · 1 plaza libre" href="#" />
            </List>
          </Card>

          <Card>
            <CardHeader title="Formulario" description="Etiqueta visible, ayuda y error debajo del campo" />
            <CardBody className="space-y-4">
              <Field label="Email" hint="Te enviaremos el recibo aquí.">
                <Input type="email" autoComplete="email" placeholder="nombre@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Nivel" error="Elige un nivel para continuar.">
                <Select defaultValue="">
                  <option value="" disabled>Elige un nivel</option>
                  <option>Iniciación</option>
                  <option>Medio</option>
                </Select>
              </Field>
            </CardBody>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title="Hojas y confirmaciones" description="Sustituyen a confirm() y a las ventanas centradas" />
            <CardBody className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setSheetOpen(true)}>Abrir hoja</Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  const ok = await confirm({
                    title: '¿Usar 1 clase de tu bolsa?',
                    description: 'Te apuntas al hueco del miércoles 14 a las 19:00. Te quedará 1 clase.',
                    confirmLabel: 'Usar 1 clase',
                  })
                  setLastAnswer(ok ? 'Confirmado' : 'Cancelado')
                }}
              >
                Confirmar acción
              </Button>
              <Button
                variant="danger-ghost"
                onClick={async () => {
                  const ok = await confirm({
                    title: '¿Dar de baja a Lucía Martín?',
                    description: 'Dejará de aparecer en sus grupos a partir del 1 de noviembre.',
                    confirmLabel: 'Dar de baja',
                    destructive: true,
                  })
                  setLastAnswer(ok ? 'Baja confirmada' : 'Cancelado')
                }}
              >
                Acción destructiva
              </Button>
              {lastAnswer && <p className="w-full text-meta text-ink-3" role="status">Resultado: {lastAnswer}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Carga y vacío" />
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <EmptyState icon={<Zap />} title="No hay huecos libres este mes" description="Te avisaremos cuando alguien de tu nivel deje una plaza." className="py-6" />
            </CardBody>
          </Card>
        </section>
      </main>

      <StickyAction>
        <Button variant="secondary" size="lg" className="flex-1 md:flex-none">Más tarde</Button>
        <Button size="lg" className="flex-1 md:flex-none">Apuntarme</Button>
      </StickyAction>

      <TabBar items={tabs} />

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Apuntarte al hueco"
        description="Miércoles 14 de octubre · 19:00 · Pista 2"
        footer={
          <>
            <Button variant="secondary" size="lg" className="sm:h-11" onClick={() => setSheetOpen(false)}>Cancelar</Button>
            <Button size="lg" className="sm:h-11" onClick={() => setSheetOpen(false)}>Pagar 12,00 €</Button>
          </>
        }
      >
        <List className="-mx-5 border-y border-line">
          <ListRow title="Usar 1 clase de la bolsa" subtitle="Te quedará 1 clase" onClick={() => setSheetOpen(false)} />
          <ListRow title="Pagar la clase suelta" subtitle="12,00 € con tarjeta" onClick={() => setSheetOpen(false)} />
        </List>
      </Sheet>
    </div>
  )
}
