import {
  Bell, BookOpen, Building2, CalendarDays, CalendarRange, CircleHelp, ClipboardCheck, Clock, CreditCard,
  Flame, Home, LayoutDashboard, Medal, MessageCircle, MoreHorizontal, Network, Package, Receipt, Settings, Shield,
  Target, Trophy, UserPlus, UserRound, Users, Zap, type LucideIcon,
} from 'lucide-react'
import type { ClubFeatures } from '@/lib/get-club-features'

export type NavItem = {
  href: string
  label: string
  shortLabel?: string
  /** Frase corta de para qué sirve; se muestra en la pantalla "Más". */
  description?: string
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
          { href: '/student', description: 'Tu próxima clase, tu progreso y tus avisos', label: 'Inicio', icon: Home, exact: true },
          { href: '/student/schedule', description: 'Tu grupo fijo, tus cuotas y avisar de que no vas', label: 'Mis clases', icon: CalendarDays },
          { href: '/student/spots', description: 'Plazas libres de tu nivel para recuperar o jugar más', label: 'Huecos', icon: UserPlus, feature: 'enable_spots', hidden: hideSpots },
          { href: '/student/bag', description: 'Tus clases guardadas, movimientos y compra de bonos', label: 'Bolsa', icon: Package, feature: 'enable_bag' },
        ],
      },
      {
        title: 'Mi pádel',
        items: [
          { href: '/student/progress', description: 'Los objetivos que te marca tu monitor', label: 'Mi progreso', shortLabel: 'Progreso', icon: Target, feature: 'enable_objectives' },
          { href: '/student/intensivos', description: 'Semanas de clases intensivas que organiza el club', label: 'Intensivos', icon: Flame, feature: 'enable_intensivos' },
          { href: '/student/tournaments', description: 'Torneos del club a los que te puedes apuntar', label: 'Torneos', icon: Medal, feature: 'enable_tournaments' },
          { href: '/student/materials', description: 'Fichas y vídeos para tu nivel', label: 'Material', icon: BookOpen, feature: 'enable_materials' },
        ],
      },
      {
        title: 'Club',
        items: [
          { href: '/student/tarifas', description: 'Precios, normas y calendario de la temporada', label: 'Tarifas y normas', icon: Receipt },
          { href: '/student/chat', description: 'Escribe al club o a tu monitor', label: 'Hablar con el club', shortLabel: 'Chat', icon: MessageCircle, feature: 'enable_chat' },
          { href: '/student/notifications', description: 'Los avisos que te ha enviado el club', label: 'Notificaciones', icon: Bell, badge: unreadCount },
        ],
      },
      {
        title: 'Cuenta',
        items: [
          { href: '/student/pagos', description: 'Lo que has pagado y qué mes cubre cada cuota', label: 'Mis pagos', icon: Receipt, feature: 'enable_payments' },
          { href: '/student/perfil', description: 'Tus datos y tu contraseña', label: 'Mis datos', icon: UserRound },
          { href: '/student/ayuda', description: 'Cómo funciona cada parte de la app', label: 'Ayuda', icon: CircleHelp },
          { href: '/student/privacidad', description: 'Tus datos personales y cómo se usan', label: 'Privacidad y datos', icon: Shield },
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
          { href: '/coach', description: 'Tus clases de hoy', label: 'Inicio', icon: Home, exact: true },
          { href: '/coach/classes', description: 'Tu semana de clases y la asistencia', label: 'Mis clases', icon: CalendarDays },
          { href: '/coach/calendario', description: 'Todas las clases del club con sus alumnos', label: 'Calendario maestro', shortLabel: 'Calendario', icon: CalendarRange },
        ],
      },
      {
        title: 'Club',
        items: [
          { href: '/coach/materials', description: 'Fichas y vídeos de todos los niveles', label: 'Material', icon: BookOpen, feature: 'enable_materials' },
          { href: '/coach/chat', description: 'Habla con el club y con tus alumnos', label: 'Chat', icon: MessageCircle, feature: 'enable_chat' },
          { href: '/coach/tarifas', description: 'Precios, normas y calendario de la temporada', label: 'Tarifas y normas', icon: Receipt },
        ],
      },
      {
        title: 'Cuenta',
        items: [{ href: '/coach/ayuda', description: 'Cómo funciona cada parte de la app', label: 'Ayuda', icon: CircleHelp }],
      },
    ],
    ['/coach', '/coach/classes', '/coach/calendario', '/coach/chat'],
    '/coach/mas',
  )
}

export function adminNav({ features, isSuperAdmin, networkName }: { features?: ClubFeatures; isSuperAdmin: boolean; networkName?: string }): AppNav {
  return build(
    features,
    [
      ...(isSuperAdmin
        ? [{ title: 'Super admin', items: [{ href: '/dashboard/clubs', description: 'Todos los clubs de la plataforma', label: 'Clubes', icon: Building2 }] }]
        : []),
      ...(networkName
        ? [{ title: `Red ${networkName}`, items: [{ href: '/dashboard/red', description: 'Todas las sedes de un vistazo y entrar a cada una', label: 'Vista de la red', shortLabel: 'Red', icon: Network }] }]
        : []),
      {
        title: 'Escuela',
        items: [
          { href: '/dashboard', description: 'Lo importante de hoy de un vistazo', label: 'Panel', icon: LayoutDashboard, exact: true },
          { href: '/dashboard/schedule', description: 'Horarios, grupos, cobros y faltas', label: 'Clases', icon: CalendarDays },
          { href: '/dashboard/students', description: 'Alumnos y monitores: altas, fichas y bajas', label: 'Usuarios', icon: Users },
          { href: '/dashboard/levels', description: 'Los niveles de juego y quién está en cada uno', label: 'Niveles', icon: Trophy },
        ],
      },
      {
        title: 'Actividad',
        items: [
          { href: '/dashboard/tournaments', description: 'Crear torneos y gestionar inscripciones', label: 'Torneos', icon: Medal, feature: 'enable_tournaments' },
          { href: '/dashboard/pista-viva', description: 'Avisa a alumnos cuando falta gente en Playtomic', label: 'Pista Viva', icon: Zap, feature: 'enable_pista_viva' },
          { href: '/dashboard/class-validation', description: 'Confirmar las clases dadas por los monitores', label: 'Validación de clases', shortLabel: 'Validación', icon: ClipboardCheck, feature: 'enable_class_validation' },
          { href: '/dashboard/coach-hours', description: 'Horas de cada monitor en el mes', label: 'Horas de monitores', shortLabel: 'Horas', icon: Clock, hideFeature: 'enable_class_validation' },
          { href: '/dashboard/materials', description: 'Subir fichas y vídeos para cada nivel', label: 'Material', icon: BookOpen, feature: 'enable_materials' },
        ],
      },
      {
        title: 'Cobros',
        items: [
          { href: '/dashboard/payments', description: 'Cobros del mes, pendientes y caja', label: 'Pagos', icon: CreditCard, feature: 'enable_payments' },
          { href: '/dashboard/tarifas', description: 'PDF de precios, normas y calendario', label: 'Tarifas y normas', icon: Receipt },
        ],
      },
      {
        title: 'Comunicación',
        items: [
          { href: '/dashboard/chat', description: 'Conversaciones con alumnos y monitores', label: 'Chat', icon: MessageCircle, feature: 'enable_chat' },
          { href: '/dashboard/notifications', description: 'Mandar avisos al móvil de los alumnos', label: 'Enviar avisos', icon: Bell },
        ],
      },
      {
        title: 'Club',
        items: [
          { href: '/dashboard/settings', description: 'Datos del club, módulos, pagos y tarifas', label: 'Configuración', icon: Settings },
          { href: '/dashboard/ayuda', description: 'Cómo funciona cada parte del panel', label: 'Ayuda', icon: CircleHelp },
        ],
      },
    ],
    ['/dashboard', '/dashboard/schedule', '/dashboard/students', '/dashboard/payments'],
    '/dashboard/mas',
  )
}

