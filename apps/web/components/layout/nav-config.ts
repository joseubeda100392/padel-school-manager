import {
  Bell, BookOpen, Building2, CalendarDays, CalendarRange, CircleHelp, ClipboardCheck, Clock, CreditCard,
  Flame, Home, LayoutDashboard, Medal, MessageCircle, MoreHorizontal, Package, Receipt, Settings, Shield,
  Target, Trophy, Users, Zap, type LucideIcon,
} from 'lucide-react'
import type { ClubFeatures } from '@/lib/get-club-features'

export type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  exact?: boolean
  badge?: number
}

export type NavGroup = { title: string; items: NavItem[] }

export type AppNav = {
  groups: NavGroup[]
  tabs: NavItem[]
  moreHref: string
}

type Feature = keyof ClubFeatures
type Candidate = NavItem & { feature?: Feature; hideFeature?: Feature; hidden?: boolean }

const MAX_TABS = 4

function enabled(features: ClubFeatures | undefined, item: Candidate) {
  if (item.hidden) return false
  if (!features) return true
  if (item.feature && !features[item.feature]) return false
  if (item.hideFeature && features[item.hideFeature]) return false
  return true
}

// Las pestañas son los accesos preferidos que el club tenga activos; si falta
// alguno se rellena con el siguiente elemento del menú, para que siempre haya
// 4 + "Más" y la barra no cambie de forma de un club a otro.
function build(
  features: ClubFeatures | undefined,
  rawGroups: { title: string; items: Candidate[] }[],
  preferredTabs: string[],
  moreHref: string,
): AppNav {
  const groups = rawGroups
    .map((g) => ({ title: g.title, items: g.items.filter((i) => enabled(features, i)) }))
    .filter((g) => g.items.length > 0)
  const all = groups.flatMap((g) => g.items)
  const byHref = new Map(all.map((i) => [i.href, i]))
  const tabs = preferredTabs.map((h) => byHref.get(h)).filter((i): i is NavItem => !!i)
  for (const item of all) {
    if (tabs.length >= MAX_TABS) break
    if (!tabs.includes(item)) tabs.push(item)
  }
  return {
    groups,
    tabs: [...tabs.slice(0, MAX_TABS), { href: moreHref, label: 'Más', icon: MoreHorizontal }],
    moreHref,
  }
}

export function studentNav({
  features,
  hideSpots,
  unreadCount,
}: {
  features?: ClubFeatures
  hideSpots: boolean
  unreadCount: number
}): AppNav {
  return build(
    features,
    [
      {
        title: 'Mis clases',
        items: [
          { href: '/student', label: 'Inicio', icon: Home, exact: true },
          { href: '/student/schedule', label: 'Mis clases', icon: CalendarDays },
          { href: '/student/spots', label: 'Huecos', icon: Zap, feature: 'enable_spots', hidden: hideSpots },
          { href: '/student/bag', label: 'Bolsa', icon: Package, feature: 'enable_bag' },
        ],
      },
      {
        title: 'Mi pádel',
        items: [
          { href: '/student/progress', label: 'Mi progreso', shortLabel: 'Progreso', icon: Target, feature: 'enable_objectives' },
          { href: '/student/intensivos', label: 'Intensivos', icon: Flame, feature: 'enable_intensivos' },
          { href: '/student/tournaments', label: 'Torneos', icon: Medal, feature: 'enable_tournaments' },
          { href: '/student/materials', label: 'Material', icon: BookOpen, feature: 'enable_materials' },
        ],
      },
      {
        title: 'Club',
        items: [
          { href: '/student/tarifas', label: 'Tarifas y normas', icon: Receipt },
          { href: '/student/chat', label: 'Hablar con el club', shortLabel: 'Chat', icon: MessageCircle, feature: 'enable_chat' },
          { href: '/student/notifications', label: 'Notificaciones', icon: Bell, badge: unreadCount },
        ],
      },
      {
        title: 'Cuenta',
        items: [
          { href: '/student/ayuda', label: 'Ayuda', icon: CircleHelp },
          { href: '/student/privacidad', label: 'Privacidad y datos', icon: Shield },
        ],
      },
    ],
    ['/student', '/student/schedule', '/student/spots', '/student/bag'],
    '/student/mas',
  )
}

export function coachNav({ features }: { features?: ClubFeatures }): AppNav {
  return build(
    features,
    [
      {
        title: 'Clases',
        items: [
          { href: '/coach', label: 'Inicio', icon: Home, exact: true },
          { href: '/coach/classes', label: 'Mis clases', icon: CalendarDays },
          { href: '/coach/calendario', label: 'Calendario maestro', shortLabel: 'Calendario', icon: CalendarRange },
        ],
      },
      {
        title: 'Club',
        items: [
          { href: '/coach/materials', label: 'Material', icon: BookOpen, feature: 'enable_materials' },
          { href: '/coach/chat', label: 'Chat', icon: MessageCircle, feature: 'enable_chat' },
          { href: '/coach/tarifas', label: 'Tarifas y normas', icon: Receipt },
        ],
      },
      {
        title: 'Cuenta',
        items: [{ href: '/coach/ayuda', label: 'Ayuda', icon: CircleHelp }],
      },
    ],
    ['/coach', '/coach/classes', '/coach/calendario', '/coach/chat'],
    '/coach/mas',
  )
}

export function adminNav({ features, isSuperAdmin }: { features?: ClubFeatures; isSuperAdmin: boolean }): AppNav {
  return build(
    features,
    [
      ...(isSuperAdmin
        ? [{ title: 'Super admin', items: [{ href: '/dashboard/clubs', label: 'Clubes', icon: Building2 }] }]
        : []),
      {
        title: 'Escuela',
        items: [
          { href: '/dashboard', label: 'Panel', icon: LayoutDashboard, exact: true },
          { href: '/dashboard/schedule', label: 'Clases', icon: CalendarDays },
          { href: '/dashboard/students', label: 'Usuarios', icon: Users },
          { href: '/dashboard/levels', label: 'Niveles', icon: Trophy },
        ],
      },
      {
        title: 'Actividad',
        items: [
          { href: '/dashboard/tournaments', label: 'Torneos', icon: Medal, feature: 'enable_tournaments' },
          { href: '/dashboard/pista-viva', label: 'Pista Viva', icon: Zap, feature: 'enable_pista_viva' },
          { href: '/dashboard/class-validation', label: 'Validación de clases', shortLabel: 'Validación', icon: ClipboardCheck, feature: 'enable_class_validation' },
          { href: '/dashboard/coach-hours', label: 'Horas de monitores', shortLabel: 'Horas', icon: Clock, hideFeature: 'enable_class_validation' },
          { href: '/dashboard/materials', label: 'Material', icon: BookOpen, feature: 'enable_materials' },
        ],
      },
      {
        title: 'Cobros',
        items: [
          { href: '/dashboard/payments', label: 'Pagos', icon: CreditCard, feature: 'enable_payments' },
          { href: '/dashboard/tarifas', label: 'Tarifas y normas', icon: Receipt },
        ],
      },
      {
        title: 'Comunicación',
        items: [
          { href: '/dashboard/chat', label: 'Chat', icon: MessageCircle, feature: 'enable_chat' },
          { href: '/dashboard/notifications', label: 'Enviar avisos', icon: Bell },
        ],
      },
      {
        title: 'Club',
        items: [
          { href: '/dashboard/settings', label: 'Configuración', icon: Settings },
          { href: '/dashboard/ayuda', label: 'Ayuda', icon: CircleHelp },
        ],
      },
    ],
    ['/dashboard', '/dashboard/schedule', '/dashboard/students', '/dashboard/payments'],
    '/dashboard/mas',
  )
}

