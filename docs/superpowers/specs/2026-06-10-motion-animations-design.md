# Motion Animations — Padel School Manager

**Fecha:** 2026-06-10
**Estilo:** Snappy + deportiva (≤300ms, spring physics)
**Librería:** `motion` v11+ (antes Framer Motion)

## Objetivo

Añadir animaciones de alta percepción en puntos clave del panel de gestión. Rápidas, con springs, que refuercen la estética Court Dark recién aplicada. No animar tablas ni formularios — solo elementos de entrada y feedback de interacción.

## Arquitectura

- Instalar `motion` en `apps/web`
- Crear `apps/web/lib/motion-variants.ts` con variantes compartidas
- Crear `apps/web/components/ui/animated-stats.tsx` (wrapper client para stat cards del dashboard)
- Modificar componentes existentes que ya son `'use client'`

## Variantes del sistema (`lib/motion-variants.ts`)

```ts
springFast     → type: spring, stiffness: 400, damping: 30
fadeUp         → hidden: { opacity:0, y:16 } / show: { opacity:1, y:0 }
staggerContainer → staggerChildren: 0.06s
pageEnter      → opacity:0, y:8 → opacity:1, y:0, duration: 0.25s
```

## Puntos de animación

| Componente | Efecto | Fichero |
|---|---|---|
| Login panel izquierdo | Logo → headline → subtext secuencial (delays 0, 0.15, 0.3s) | `app/login/page.tsx` |
| Login panel derecho | Slide desde x:20 al montar | `app/login/page.tsx` |
| Sidebar nav items (admin) | staggerContainer + fadeUp al montar | `components/layout/sidebar.tsx` |
| Sidebar nav items (student) | Mismo stagger | `components/layout/student-shell.tsx` |
| Sidebar nav items (coach) | Mismo stagger | `components/layout/coach-shell.tsx` |
| Dashboard stat cards | stagger + spring desde y:16 | `components/ui/animated-stats.tsx` (nuevo) |
| Páginas del dashboard | fadeUp en `<main>` al navegar | `components/layout/dashboard-shell.tsx` |
| Hover en cards de contenido | whileHover: y:-2, springFast | `app/dashboard/page.tsx` |
| Botones primarios | whileTap: scale:0.97 | Global en componentes clave |
| Bolsa de clases (número) | useSpring para animación de conteo | `components/layout/student-shell.tsx` |

## Lo que NO se anima

- Tablas y filas de lista (uso frecuente, se vuelven obstáculos)
- Formularios y inputs
- Modales y toasts (Sonner ya los maneja)
- Notificaciones badge

## Bundle estimado

~25-30kb tras tree-shaking de Next.js. Aceptable para el panel (no es landing page).

## Imports

```ts
import { motion, useSpring, useMotionValue, AnimatePresence } from 'motion/react'
```
