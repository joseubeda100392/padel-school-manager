'use client'

import Link from 'next/link'
import { LogOut, Repeat } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { List, ListRow } from '@/components/ui/list'
import { Badge } from '@/components/ui/badge'
import { useShell } from './app-shell'

function RowIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-control bg-ink/[0.05] text-ink-2 [&_svg]:h-5 [&_svg]:w-5">
      {children}
    </span>
  )
}

// Pantalla "Más": todo lo que no cabe en las 4 pestañas, agrupado igual que el
// menú lateral del ordenador para que la app se recorra igual en los dos.
export function MoreMenu() {
  const { nav, identity, roleSwitch, legalLinks, logout } = useShell()
  const tabHrefs = new Set(nav.tabs.map((t) => t.href))
  const groups = nav.groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !tabHrefs.has(i.href)) }))
    .filter((g) => g.items.length > 0)
  const initials = identity.name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <h1 className="font-display text-title text-ink">Más</h1>

      <Card className="flex items-center gap-3 px-4 py-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-chrome font-display text-label text-chrome-ink">
          {initials || '?'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.9375rem] font-medium text-ink">{identity.name}</p>
          <p className="truncate text-meta text-ink-3">{identity.subtitle}</p>
        </div>
      </Card>

      {groups.map((group) => (
        <section key={group.title} aria-labelledby={`mas-${group.title}`}>
          <h2 id={`mas-${group.title}`} className="px-1 pb-2 text-meta font-medium text-ink-3">{group.title}</h2>
          <Card className="overflow-hidden">
            <List>
              {group.items.map(({ href, label, icon: Icon, badge }) => (
                <ListRow
                  key={href}
                  href={href}
                  leading={<RowIcon><Icon aria-hidden /></RowIcon>}
                  title={label}
                  trailing={badge ? <Badge tone="danger">{badge > 9 ? '9+' : badge}<span className="sr-only"> sin leer</span></Badge> : undefined}
                />
              ))}
            </List>
          </Card>
        </section>
      ))}

      <Card className="overflow-hidden">
        <List>
          {roleSwitch && (
            <ListRow href={roleSwitch.href} leading={<RowIcon><Repeat aria-hidden /></RowIcon>} title={roleSwitch.label} />
          )}
          <ListRow
            onClick={logout}
            leading={<RowIcon><LogOut aria-hidden /></RowIcon>}
            title={<span className="text-danger-ink">Cerrar sesión</span>}
          />
        </List>
      </Card>

      {legalLinks.length > 0 && (
        <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 pb-2 text-meta text-ink-3">
          {legalLinks.map((l) => (
            <Link key={l.href} href={l.href} target={l.external ? '_blank' : undefined} className="underline-offset-4 hover:underline">
              {l.label}
            </Link>
          ))}
        </p>
      )}
    </div>
  )
}
