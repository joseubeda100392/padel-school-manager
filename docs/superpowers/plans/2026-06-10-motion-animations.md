# Motion Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir animaciones snappy spring-based (≤300ms) en login, sidebars, dashboard stats y transiciones de página usando la librería Motion.

**Architecture:** Instalar `motion` en `apps/web`. Variantes compartidas en `lib/motion-variants.ts`. Wrapper client `AnimatedStatsGrid` para el dashboard (server component). Los shells (sidebar, student, coach) son ya `'use client'` y reciben motion directamente.

**Tech Stack:** Next.js 14 App Router, Motion v11+ (`motion/react`), TypeScript, Tailwind CSS

---

### Task 1: Instalar Motion

**Files:**
- Modify: `apps/web/package.json` (via pnpm)

- [ ] **Step 1: Instalar el paquete**

```
pnpm --filter web add motion
```

Resultado esperado: `+ motion@x.x.x` añadido a `apps/web/package.json` y `pnpm-lock.yaml` actualizado.

- [ ] **Step 2: Commit**

```
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): install motion for animations"
```

---

### Task 2: Crear variantes de animación compartidas

**Files:**
- Create: `apps/web/lib/motion-variants.ts`

- [ ] **Step 1: Crear el fichero**

Crear `apps/web/lib/motion-variants.ts` con este contenido exacto:

```ts
import type { Variants, Transition } from 'motion/react'

export const springFast: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: springFast,
  },
}

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
}

export const pageEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
}
```

- [ ] **Step 2: Verificar TypeScript**

```
pnpm --filter web exec tsc --noEmit
```

Resultado esperado: sin output (sin errores).

- [ ] **Step 3: Commit**

```
git add apps/web/lib/motion-variants.ts
git commit -m "feat(web): add shared motion animation variants"
```

---

### Task 3: Animar login page

**Files:**
- Modify: `apps/web/app/login/page.tsx`

El componente ya es `'use client'`. Se añaden animaciones secuenciales al panel izquierdo y slide al panel derecho.

- [ ] **Step 1: Añadir import de motion**

Al inicio del fichero, añadir:

```ts
import { motion } from 'motion/react'
```

- [ ] **Step 2: Animar logo del panel izquierdo**

Encontrar:
```tsx
<div className="relative">
  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-blue-500">
    <span className="text-base font-bold text-white">P</span>
  </div>
</div>
```

Reemplazar con:
```tsx
<motion.div
  className="relative"
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.4, ease: 'easeOut' }}
>
  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-blue-500">
    <span className="text-base font-bold text-white">P</span>
  </div>
</motion.div>
```

- [ ] **Step 3: Animar headline y subtext del panel izquierdo**

Encontrar:
```tsx
<div className="relative space-y-6">
  <h1 className="font-display text-[52px] font-bold leading-[1.1] text-white">
    Gestiona<br />tu escuela<br />de <span className="text-brand-400">pádel.</span>
  </h1>
  <p className="text-lg leading-relaxed text-court-300">
    Alumnos, clases y pagos<br />en un solo lugar.
  </p>
</div>
```

Reemplazar con:
```tsx
<div className="relative space-y-6">
  <motion.h1
    className="font-display text-[52px] font-bold leading-[1.1] text-white"
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
  >
    Gestiona<br />tu escuela<br />de <span className="text-brand-400">pádel.</span>
  </motion.h1>
  <motion.p
    className="text-lg leading-relaxed text-court-300"
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
  >
    Alumnos, clases y pagos<br />en un solo lugar.
  </motion.p>
</div>
```

- [ ] **Step 4: Animar panel derecho (slide desde x)**

Encontrar la apertura del panel derecho:
```tsx
<div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12">
```

Reemplazar con:
```tsx
<motion.div
  className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12"
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
>
```

Cambiar el cierre `</div>` correspondiente a `</motion.div>`.

- [ ] **Step 5: Añadir tap feedback al botón de submit**

Encontrar:
```tsx
<button
  type="submit"
  disabled={loading}
  className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
>
```

Reemplazar con:
```tsx
<motion.button
  type="submit"
  disabled={loading}
  className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
  whileTap={{ scale: 0.97 }}
  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
>
```

Cambiar el cierre `</button>` a `</motion.button>`.

- [ ] **Step 6: Verificar compilación**

```
pnpm --filter web exec tsc --noEmit
```

Resultado esperado: sin output.

- [ ] **Step 7: Verificación visual en http://localhost:3000/login**

Al cargar la página:
- El logo escala desde 80% → 100%
- El headline sube con delay 0.15s
- El subtext sube con delay 0.3s
- El panel derecho desliza desde x:20
- El botón "Entrar" se aplasta al hacer click

- [ ] **Step 8: Commit**

```
git add apps/web/app/login/page.tsx
git commit -m "feat(web): animate login page entrance"
```

---

### Task 4: Stagger nav items del sidebar admin

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1: Añadir imports**

Al inicio del fichero añadir:
```ts
import { motion } from 'motion/react'
import { staggerContainer, fadeUp } from '@/lib/motion-variants'
```

- [ ] **Step 2: Convertir `<nav>` en `<motion.nav>`**

Encontrar:
```tsx
<nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
```

Reemplazar con:
```tsx
<motion.nav
  className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4"
  variants={staggerContainer}
  initial="hidden"
  animate="show"
>
```

Cambiar el `</nav>` de cierre a `</motion.nav>`.

- [ ] **Step 3: Envolver superAdminItems en motion.div**

Encontrar:
```tsx
{superAdminItems.map(({ href, label, icon: Icon }) => (
  <Link
    key={href}
    href={href}
    onClick={onClose}
    className={cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
      pathname.startsWith(href)
        ? 'bg-brand-500/15 text-brand-400'
        : 'text-court-200 hover:bg-court-800 hover:text-white',
    )}
  >
    <Icon className="h-4 w-4 shrink-0" />
    {label}
  </Link>
))}
```

Reemplazar con:
```tsx
{superAdminItems.map(({ href, label, icon: Icon }) => (
  <motion.div key={href} variants={fadeUp}>
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        pathname.startsWith(href)
          ? 'bg-brand-500/15 text-brand-400'
          : 'text-court-200 hover:bg-court-800 hover:text-white',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  </motion.div>
))}
```

- [ ] **Step 4: Envolver navItems en motion.div**

Encontrar:
```tsx
{navItems.map(({ href, label, icon: Icon }) => (
  <Link
    key={href}
    href={href}
    onClick={onClose}
    className={cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
      (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
        ? 'bg-brand-500/15 text-brand-400'
        : 'text-court-200 hover:bg-court-800 hover:text-white',
    )}
  >
    <Icon className="h-4 w-4 shrink-0" />
    {label}
  </Link>
))}
```

Reemplazar con:
```tsx
{navItems.map(({ href, label, icon: Icon }) => (
  <motion.div key={href} variants={fadeUp}>
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
          ? 'bg-brand-500/15 text-brand-400'
          : 'text-court-200 hover:bg-court-800 hover:text-white',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  </motion.div>
))}
```

- [ ] **Step 5: Verificar y commit**

```
pnpm --filter web exec tsc --noEmit
git add apps/web/components/layout/sidebar.tsx
git commit -m "feat(web): stagger admin sidebar nav items on mount"
```

---

### Task 5: Stagger student shell + número animado en bolsa

**Files:**
- Modify: `apps/web/components/layout/student-shell.tsx`

- [ ] **Step 1: Actualizar imports**

Encontrar la línea de imports de React:
```ts
import { useState } from 'react'
```

Reemplazar con:
```ts
import { useState, useEffect } from 'react'
```

Añadir justo después:
```ts
import { motion, useSpring, useTransform } from 'motion/react'
import { staggerContainer, fadeUp } from '@/lib/motion-variants'
```

- [ ] **Step 2: Añadir componente AnimatedNumber antes de StudentShell**

Insertar antes de `export function StudentShell`:

```tsx
function AnimatedNumber({ target }: { target: number }) {
  const spring = useSpring(0, { stiffness: 300, damping: 30 })
  const rounded = useTransform(spring, Math.round)

  useEffect(() => {
    spring.set(target)
  }, [target, spring])

  return <motion.span>{rounded}</motion.span>
}
```

- [ ] **Step 3: Reemplazar el número estático de la bolsa**

Encontrar dentro del widget de bolsa:
```tsx
<p className="mt-0.5 font-display text-3xl font-bold text-white">{bagBalance}</p>
```

Reemplazar con:
```tsx
<p className="mt-0.5 font-display text-3xl font-bold text-white">
  <AnimatedNumber target={bagBalance} />
</p>
```

- [ ] **Step 4: Convertir `<nav>` en `<motion.nav>` en el sidebar**

Encontrar la nav dentro del `<aside>`:
```tsx
<nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
```

Reemplazar con:
```tsx
<motion.nav
  className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4"
  variants={staggerContainer}
  initial="hidden"
  animate="show"
>
```

Cambiar `</nav>` a `</motion.nav>`.

- [ ] **Step 5: Envolver navItems del sidebar en motion.div**

Encontrar el map de navItems dentro del `<aside>` (no el del bottom nav):
```tsx
{navItems.map(({ href, label, icon: Icon, exact }) => {
  const active = exact ? pathname === href : pathname.startsWith(href)
  const isNotif = href === '/student/notifications'
  return (
    <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        active ? 'bg-brand-500/15 text-brand-400' : 'text-court-200 hover:bg-court-800 hover:text-white'
      )}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {isNotif && unreadCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
})}
```

Reemplazar con:
```tsx
{navItems.map(({ href, label, icon: Icon, exact }) => {
  const active = exact ? pathname === href : pathname.startsWith(href)
  const isNotif = href === '/student/notifications'
  return (
    <motion.div key={href} variants={fadeUp}>
      <Link href={href} onClick={() => setSidebarOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
          active ? 'bg-brand-500/15 text-brand-400' : 'text-court-200 hover:bg-court-800 hover:text-white'
        )}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{label}</span>
        {isNotif && unreadCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
    </motion.div>
  )
})}
```

- [ ] **Step 6: Verificar y commit**

```
pnpm --filter web exec tsc --noEmit
git add apps/web/components/layout/student-shell.tsx
git commit -m "feat(web): stagger student nav + animate bag balance number"
```

---

### Task 6: Stagger coach shell nav

**Files:**
- Modify: `apps/web/components/layout/coach-shell.tsx`

- [ ] **Step 1: Añadir imports**

```ts
import { motion } from 'motion/react'
import { staggerContainer, fadeUp } from '@/lib/motion-variants'
```

- [ ] **Step 2: Convertir `<nav>` en `<motion.nav>`**

Encontrar dentro del `<aside>`:
```tsx
<nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
```

Reemplazar con:
```tsx
<motion.nav
  className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4"
  variants={staggerContainer}
  initial="hidden"
  animate="show"
>
```

Cambiar `</nav>` a `</motion.nav>`.

- [ ] **Step 3: Envolver navItems en motion.div**

Encontrar:
```tsx
{navItems.map(({ href, label, icon: Icon, exact }) => {
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        active ? 'bg-blue-500/15 text-blue-400' : 'text-court-200 hover:bg-court-800 hover:text-white'
      )}>
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
})}
```

Reemplazar con:
```tsx
{navItems.map(({ href, label, icon: Icon, exact }) => {
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <motion.div key={href} variants={fadeUp}>
      <Link href={href} onClick={() => setSidebarOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
          active ? 'bg-blue-500/15 text-blue-400' : 'text-court-200 hover:bg-court-800 hover:text-white'
        )}>
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </Link>
    </motion.div>
  )
})}
```

- [ ] **Step 4: Verificar y commit**

```
pnpm --filter web exec tsc --noEmit
git add apps/web/components/layout/coach-shell.tsx
git commit -m "feat(web): stagger coach nav items on mount"
```

---

### Task 7: Crear AnimatedStatsGrid + conectar al dashboard

**Files:**
- Create: `apps/web/components/ui/animated-stats.tsx`
- Modify: `apps/web/app/dashboard/page.tsx`

- [ ] **Step 1: Crear el componente**

Crear `apps/web/components/ui/animated-stats.tsx`:

```tsx
'use client'

import { Children } from 'react'
import { motion } from 'motion/react'
import { springFast } from '@/lib/motion-variants'

export function AnimatedStatsGrid({ children }: { children: React.ReactNode }) {
  const items = Children.toArray(children)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springFast, delay: i * 0.08 }}
          whileHover={{ y: -2, transition: springFast }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Añadir import en dashboard/page.tsx**

Añadir al inicio de `apps/web/app/dashboard/page.tsx`:
```ts
import { AnimatedStatsGrid } from '@/components/ui/animated-stats'
```

- [ ] **Step 3: Reemplazar el grid de stats en dashboard/page.tsx**

Encontrar:
```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  {stats.map((stat) => (
    <div key={stat.label} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md hover:ring-gray-200">
      <div className={`inline-flex rounded-xl p-2.5 ${stat.color} bg-opacity-10`}>
        <stat.icon className={`h-5 w-5 ${stat.color.replace('bg-', 'text-')}`} />
      </div>
      <p className="mt-4 font-display text-3xl font-bold text-gray-900">{stat.value}</p>
      <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
    </div>
  ))}
</div>
```

Reemplazar con:
```tsx
<AnimatedStatsGrid>
  {stats.map((stat) => (
    <div key={stat.label} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 h-full">
      <div className={`inline-flex rounded-xl p-2.5 ${stat.color} bg-opacity-10`}>
        <stat.icon className={`h-5 w-5 ${stat.color.replace('bg-', 'text-')}`} />
      </div>
      <p className="mt-4 font-display text-3xl font-bold text-gray-900">{stat.value}</p>
      <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
    </div>
  ))}
</AnimatedStatsGrid>
```

- [ ] **Step 4: Verificar compilación**

```
pnpm --filter web exec tsc --noEmit
```

Resultado esperado: sin output.

- [ ] **Step 5: Verificación visual**

Abrir el dashboard. Las 4 stat cards aparecen con stagger (80ms entre cada una) y se levantan 2px al hacer hover.

- [ ] **Step 6: Commit**

```
git add apps/web/components/ui/animated-stats.tsx apps/web/app/dashboard/page.tsx
git commit -m "feat(web): animate dashboard stat cards with spring stagger"
```

---

### Task 8: Transición de página en dashboard shell

**Files:**
- Modify: `apps/web/components/layout/dashboard-shell.tsx`

Usar `usePathname()` como `key` del motion.div que envuelve el contenido. Al cambiar de página, el `key` cambia, React desmonta y remonta el div, disparando la animación de entrada.

- [ ] **Step 1: Añadir imports**

Al inicio de `dashboard-shell.tsx` añadir:
```ts
import { motion } from 'motion/react'
import { usePathname } from 'next/navigation'
```

- [ ] **Step 2: Leer el pathname**

Dentro de `DashboardShell`, después del `useState`:
```ts
const pathname = usePathname()
```

- [ ] **Step 3: Envolver el contenido de `<main>`**

Encontrar:
```tsx
<main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
```

Reemplazar con:
```tsx
<main className="flex-1 overflow-auto p-4 md:p-8">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
</main>
```

- [ ] **Step 4: Verificar compilación**

```
pnpm --filter web exec tsc --noEmit
```

Resultado esperado: sin output.

- [ ] **Step 5: Verificación visual**

Navegar entre páginas del dashboard (Dashboard → Alumnos → Clases). Cada página hace fade + slide-up en 250ms. Snappy y limpio.

- [ ] **Step 6: Commit**

```
git add apps/web/components/layout/dashboard-shell.tsx
git commit -m "feat(web): add page transition animation to dashboard shell"
```

---

### Task 9: Deploy a Railway

- [ ] **Step 1: Verificación TypeScript final**

```
pnpm --filter web exec tsc --noEmit
```

Resultado esperado: sin output.

- [ ] **Step 2: Push**

```
git push origin master
```

Railway detecta el push y despliega automáticamente.
