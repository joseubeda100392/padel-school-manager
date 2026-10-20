'use client'

import { Bell, BookOpen, CalendarDays, CircleHelp, Flame, Home, Medal, MessageCircle, MoreHorizontal, Package, Receipt, Target, User, Zap, LogOut } from 'lucide-react'
import { AppBar, TabBar } from '@/components/ui/app-chrome'
import { Card } from '@/components/ui/card'
import { List, ListRow } from '@/components/ui/list'
import { Badge } from '@/components/ui/badge'

// Maqueta de la navegación del alumno: 4 pestañas + "Más" (solo desarrollo).
const tabs = [
  { href: '/dev/design/inicio', label: 'Inicio', icon: Home },
  { href: '/dev/design/clases', label: 'Mis clases', icon: CalendarDays },
  { href: '/dev/design/huecos', label: 'Reservar', icon: Zap, badge: 3 },
  { href: '/dev/design/bolsa', label: 'Bolsa', icon: Package },
  { href: '/dev/design/mas', label: 'Más', icon: MoreHorizontal },
]

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-meta font-medium text-ink-3">{title}</h2>
      <Card className="overflow-hidden">
        <List>{children}</List>
      </Card>
    </section>
  )
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="flex h-9 w-9 items-center justify-center rounded-control bg-ink/[0.05] text-ink-2 [&_svg]:h-5 [&_svg]:w-5">{children}</span>
}

export function MasMock() {
  return (
    <div className="min-h-dvh bg-canvas pb-[calc(var(--tabbar-h)+var(--safe-bottom)+1.5rem)] font-sans">
      <AppBar title="Más" actions={<span className="relative flex h-11 w-11 items-center justify-center text-ink"><Bell className="h-5 w-5" /><span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-danger-ink" /></span>} />
      <main className="mx-auto max-w-lg space-y-6 px-4 py-5">
        <Card className="overflow-hidden">
          <List>
            <ListRow
              leading={<span className="flex h-11 w-11 items-center justify-center rounded-full bg-chrome font-display text-label text-chrome-ink">LM</span>}
              title="Lucía Martín"
              subtitle="X7 PINTO · Nivel medio"
              href="#"
            />
          </List>
        </Card>
        <Group title="Mi pádel">
          <ListRow leading={<Icon><Target /></Icon>} title="Mi progreso" href="#" />
          <ListRow leading={<Icon><Flame /></Icon>} title="Intensivos" href="#" />
          <ListRow leading={<Icon><Medal /></Icon>} title="Torneos" trailing={<Badge tone="success">Nuevo</Badge>} href="#" />
          <ListRow leading={<Icon><BookOpen /></Icon>} title="Material de tu nivel" href="#" />
        </Group>
        <Group title="Club">
          <ListRow leading={<Icon><Receipt /></Icon>} title="Tarifas, normas y calendario" href="#" />
          <ListRow leading={<Icon><MessageCircle /></Icon>} title="Hablar con el club" trailing={<Badge tone="danger">1</Badge>} href="#" />
        </Group>
        <Group title="Cuenta">
          <ListRow leading={<Icon><User /></Icon>} title="Datos y contraseña" href="#" />
          <ListRow leading={<Icon><Bell /></Icon>} title="Avisos" subtitle="Activados en este móvil" href="#" />
          <ListRow leading={<Icon><CircleHelp /></Icon>} title="Ayuda" href="#" />
        </Group>
        <Card className="overflow-hidden">
          <List>
            <ListRow leading={<Icon><LogOut /></Icon>} title={<span className="text-danger-ink">Cerrar sesión</span>} onClick={undefined} />
          </List>
        </Card>
      </main>
      <TabBar items={tabs} />
    </div>
  )
}
