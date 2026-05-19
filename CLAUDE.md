# CLAUDE.md — Padel School Manager

## ⚠️ REGLA CRÍTICA: NO TOCAR apps/mobile
`apps/mobile` está DESCARTADA. No se usa. No modificar, no mencionar, no sugerir nada relacionado con React Native/Expo.
Todo el trabajo va en `apps/web` únicamente.

## Descripción del Proyecto
Ecosistema digital para escuelas de pádel compuesto por:
- `apps/web`: Aplicación web Next.js 14 (App Router) para alumnos, monitores y admins — deploy en Railway
- `packages/db`: Prisma schema y cliente compartido (PostgreSQL/Supabase)
- `packages/types`: Tipos TypeScript compartidos entre apps
- `packages/stripe`: Lógica de pagos Stripe compartida

## Stack
- Mobile: React Native + Expo SDK 51 + NativeWind (iOS y Android)
- Web: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui → Railway
- DB: PostgreSQL (Supabase) + Prisma ORM
- Auth: Supabase Auth (JWT con claims de rol)
- Realtime/Chat: Supabase Realtime
- Pagos: Stripe (subscripciones + PaymentIntent para clases sueltas)
- Storage: Supabase Storage (PDFs, avatares)
- Push: Expo Push Notifications + FCM
- Deploy Web/Backend: Railway
- Deploy Mobile: Expo EAS Build
- Monorepo: Turborepo + pnpm workspaces

## Estrategia de Modelos (Eficiencia de Tokens)

| Agente | Modelo | Cuándo usarlo |
|---|---|---|
| Explore subagent | **Haiku** | Buscar archivos, leer docs, grep en el codebase — SIEMPRE primero |
| general-purpose subagent | **Sonnet** | Escribir componentes, API routes, lógica de negocio, tests |
| Plan subagent | **Opus** | Arquitectura crítica, auditorías de seguridad — uso reservado |

**Regla:** Si es solo lectura → Haiku. Si hay que generar código → Sonnet. Si afecta arquitectura global → Opus.

## Estilo de Comunicación
Respuestas cortas y directas siempre. Sin introducciones, sin resúmenes al final, sin frases de cortesía.
Una frase por actualización. Código sin comentarios obvios.

## Skills — Cuándo Usarlas (Auto-invocación)

### Uso automático (sin que el usuario lo pida)
| Skill | Se invoca cuando... |
|---|---|
| `/security-review` | Se toca auth, RLS, Stripe, API routes, o permisos |
| `/simplify` | Se implementa una feature compleja (>50 líneas nuevas) |
| `/review` | Antes de hacer push de cambios críticos |
| `/deploy-check` | Antes de cada `git push` a Railway |
| `claude-mem:mem-search` | Al inicio de una tarea para buscar soluciones previas |

### Uso manual (el usuario las invoca)
| Skill | Para qué |
|---|---|
| `/caveman` | Modo respuesta ultra-terse |
| `/caveman-review` | Review de código en formato estructurado |
| `/caveman-commit` | Generar mensaje de commit |
| `/loop` | Monitorizar proceso en bucle (Railway deploy, tests) |
| `/schedule` | Crear agente recurrente (reporte semanal, alerta) |
| `/claude-api` | Integrar Anthropic API en la app |
| `/update-config` | Cambiar permisos o hooks en settings.json |
| `/fewer-permission-prompts` | Reducir interrupciones de permisos |
| `claude-mem:learn-codebase` | Cargar todo el codebase en memoria al inicio |
| `claude-mem:make-plan` | Planificar feature compleja antes de ejecutar |
| `claude-mem:do` | Ejecutar un plan creado con make-plan |

## Convenciones de Código
- TypeScript estricto (`strict: true`) en todo el proyecto
- Archivos: kebab-case para rutas/páginas, PascalCase para componentes
- Variables/funciones: camelCase, tipos/interfaces: PascalCase
- Sin comentarios obvios; solo cuando el WHY no es evidente
- Sin manejo de errores para escenarios imposibles
- Imports absolutos desde `@/` en cada app
- Gestor de paquetes: **pnpm** (no npm, no yarn)
- **Todo el código web es responsive por defecto**, sin que el usuario lo pida:
  - Tablas siempre dentro de `overflow-x-auto`
  - Grids empiezan en 1 columna: `grid-cols-1 sm:grid-cols-2`
  - Flex rows con `flex-wrap` cuando los elementos pueden no caber
  - Cabeceras con botones: `flex-wrap gap-2`
  - Inputs y botones: `w-full` en móvil, anchos fijos solo en `sm:` en adelante

## Variables de Entorno
Variables en `.env.local` (nunca en git). Ver `.env.example` para la lista completa.

Críticas:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `RAILWAY_TOKEN`
- `DATABASE_URL`

## Roles de Usuario
- `student`: reservas, bolsa de clases, PDFs de su nivel, chat soporte
- `coach`: vista de clases, asistencia, todos los PDFs, chat soporte
- `admin`: panel web completo, todas las operaciones

## Funcionalidades Core

### F1: Bolsa de Clases + Pay-per-class
- Alumnos tienen saldo de clases (`class_bag.balance`)
- Huecos libres (no-shows) pueden cubrirse con bolsa o pago único vía Stripe PaymentIntent
- Admin configura precio de clase suelta

### F2: Gestión de Niveles
- CRUD de niveles en panel admin
- Historial de cambios por alumno en `user_levels`
- App alumno muestra progresión, app monitor muestra nivel en lista de clase

### F3: Chat de Soporte
- Supabase Realtime sobre tabla `chat_messages`
- Push notification al destinatario en cada mensaje nuevo
- Admin gestiona todos los hilos desde el panel

### F4: PDFs Didácticos
- Upload a Supabase Storage, asignación por nivel
- App alumno filtra por su nivel, app monitor ve todos

## Supabase — Regla de Oro (NO ROMPER)

**En server components (pages) SIEMPRE usar `supabaseAdmin` para queries de datos.**

```ts
import { createClient } from '@/lib/supabase/server'   // SOLO para auth
import { supabaseAdmin } from '@/lib/supabase/admin'    // PARA TODOS los datos

const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser() // auth con session
const { data } = await supabaseAdmin.from('tabla')...    // datos con admin
```

**Por qué:** El cliente de sesión respeta RLS. Un alumno no puede leer datos de otros usuarios (coaches, admins), ni tablas sin política explícita (user_levels, material_levels, bookings de otros, etc.). El admin client (`supabaseAdmin`, service role) bypassa RLS de forma segura porque corre en el servidor.

**Regla práctica:**
- `createClient()` → solo para `supabase.auth.getUser()` 
- `supabaseAdmin` → TODO lo demás en server components
- En API routes → crear admin client inline dentro de la función (patrón ya establecido)
- En Client Components → usar `createClient()` de `@/lib/supabase/client` (corre en el browser del usuario, RLS es correcto)

## Depuración — Protocolo Obligatorio
Ante cualquier bug que no sea obvio en el código:
1. **Primero capturar el error real**: añadir `const { data, error } = await ...` y mostrar `error` en pantalla o en consola antes de hacer ningún cambio.
2. **Nunca hacer cambios a ciegas** esperando que "quizás sea esto". Sin evidencia no hay fix.
3. Para bugs de RLS/Supabase: ejecutar la query diagnóstico en el SQL Editor ANTES de tocar políticas.
4. Para bugs de Next.js server: añadir `console.error` o renderizar el error en pantalla, deployar, leer el error, luego arreglar.

## Flujos Críticos (No Modificar Sin /security-review)
1. **Webhook Stripe** → `/supabase/functions/stripe-webhook` → actualiza `payments` y `class_bag`
2. **Supabase RLS** activo en todas las tablas — revisar políticas antes de cambios de schema
3. **Realtime chat** → tabla `chat_messages` con RLS por `thread_id`
4. **Auth middleware** → verificar `role` en JWT claims antes de cualquier operación admin

## Sistema de Memoria Automática
- Directorio: `~/.claude/projects/.../memory/`
- Consultar SIEMPRE antes de generar código nuevo
- Guardar: correcciones de estilo (`feedback`), decisiones de arquitectura (`project`), preferencias del usuario (`user`)

## Esquema de Base de Datos (Entidades)
```
users · levels · user_levels · courts · schedules · bookings
class_bag · bag_transactions · payments · chat_threads · chat_messages
materials · material_levels · notifications
```
Schema completo en `packages/db/schema.prisma`.
