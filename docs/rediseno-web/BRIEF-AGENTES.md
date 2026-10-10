# Brief para rediseñar pantallas (rama `rediseno-web`)

Estás migrando pantallas de una app real EN PRODUCCIÓN (Next.js 14 App Router + Tailwind) al nuevo sistema de diseño. Es una app que se usa sobre todo desde el móvil (PWA instalada).

## Reglas de seguridad (obligatorias)
- NO cambies lógica: ni llamadas a la API, ni consultas a Supabase, ni cálculos, ni props que reciben los componentes desde fuera, ni nombres de exports. Solo la capa visual (JSX, clases, textos de interfaz) y, donde se indica, `confirm()`/`alert()` → componentes nuevos.
- NO toques: `app/api/**`, `lib/**` (salvo leer), `components/ui/**`, `components/layout/**`, `components/month-calendar.tsx`, `components/pay-button.tsx`, `tailwind.config.ts`, `globals.css`. Si necesitas algo nuevo en un componente compartido, NO lo cambies: dilo en tu informe final.
- NO hagas commits, ni `git` de ningún tipo que modifique el repo. NO arranques el servidor de desarrollo. NO escribas en la base de datos ni ejecutes scripts contra ella.
- Trabaja solo en los archivos de tu lista. Comprueba con `cd apps/web && pnpm exec tsc --noEmit --pretty false 2>&1 | grep -v "^test/"` que no hay errores nuevos (los de `test/` ya existían).

## Lee primero
1. `design.md` (raíz): sistema completo. Síguelo al pie de la letra.
2. Componentes en `apps/web/components/ui/`: `button.tsx` (Button, buttonVariants), `card.tsx` (Card, CardHeader, CardBody, SectionTitle), `badge.tsx` (Badge con tone neutral|success|warn|danger|outline, LevelTag), `field.tsx` (Field, Input, Select, Textarea), `feedback.tsx` (Skeleton, EmptyState, Notice), `list.tsx` (List, ListRow, DateTile, Avatar, Stat), `page-header.tsx` (PageHeader), `confirm.tsx` (useConfirm), `sheet.tsx` (Sheet), `court-card.tsx` (solo para "próxima clase").
3. `apps/web/lib/format-date.ts`: `formatLongDate`, `formatShortDay`, `formatClock`. Úsalas en vez de `toLocaleDateString` + `capitalize` (que daba "12 De Octubre").
4. Ejemplos ya migrados (cópiales el estilo): `app/student/page.tsx`, `app/student/schedule/schedule-client.tsx`, `app/student/schedule/spot-booking-card.tsx`, `app/student/spots/spots-client.tsx`, `app/student/bag/page.tsx`, `app/student/perfil/page.tsx`, `components/layout/more-menu.tsx`.

## Cómo migrar cada pantalla
- Cabecera: `<PageHeader title description actions back />`. Contenedor: `mx-auto w-full max-w-3xl space-y-6` (pantallas de lectura), `max-w-5xl` (dos columnas) o sin máximo en tablas de admin. El shell ya pone el padding lateral y el fondo.
- Colores SOLO con tokens: `bg-surface`, `bg-surface-2`, `bg-canvas`, `border-line`, `text-ink`, `text-ink-2`, `text-ink-3`, `bg-accent` (+ `text-accent-on`), `text-accent-ink`, `bg-accent-soft`, `text-warn-ink`/`bg-warn-soft`, `text-danger-ink`/`bg-danger-soft`, `bg-chrome`... Prohibido: `brand-*`, `court-*`, `blue-*`, `orange-*`, `purple-*`, `pink-*`, `amber-*`, `red-*`, `green-*`, `emerald-*`, `indigo-*`, `yellow-*`, hex sueltos, `text-white` sobre verde.
- Tipografía: `font-display text-title|text-display` para títulos y cifras grandes; `text-heading`, `text-body`, `text-label`, `text-meta`. Mínimo `text-meta` (13 px). Nada de `text-[10px]`/`text-[11px]`/`text-xs` en texto que haya que leer. `tabular-nums` en importes, horas, contadores.
- Tarjetas: `<Card>`; nunca `rounded-xl bg-white shadow-sm` a mano. Listas de elementos: `<List>` + `<ListRow>` dentro de una Card (filas con separador), NO una tarjeta por elemento.
- Botones: `<Button variant="primary|secondary|ghost|danger|danger-ghost|link" size="sm|md|lg" loading>`; enlaces con aspecto de botón: `className={buttonVariants({...})}`. Un solo botón `primary` por pantalla o sección. Texto que dice lo que hace ("Guardar cambios", "Pagar 46,00 €"), nunca "Enviar"/"OK".
- Estados: `<Badge tone=...>` con icono Lucide (`CircleCheck`, `CircleAlert`, `Clock`...) además del color. Niveles de alumno: `<LevelTag name color />` (punto + nombre), nunca pastilla de color con texto blanco.
- Avisos: `<Notice tone icon action>`. Vacíos: `<EmptyState icon title description action>` con frase útil.
- Formularios: `<Field label hint error><Input .../></Field>` (etiqueta visible siempre; el placeholder no es etiqueta). `autoComplete` e `inputMode` correctos.
- Iconos: solo Lucide (`lucide-react`), `h-4 w-4`/`h-5 w-5`, `aria-hidden` si acompañan texto, `aria-label` si van solos. PROHIBIDOS LOS EMOJIS en la interfaz (👋 💳 📅 ⚠️ ✓ 🎾 ⚡ 📋 🎟️ etc.): sustitúyelos por icono Lucide o quítalos. El "✓" de texto también fuera (usa `Check`/`CircleCheck`).
- `confirm()` → `const confirm = useConfirm()` y `if (!(await confirm({ title, description, confirmLabel, destructive })))` (el `ConfirmProvider` ya está en el shell de alumno, monitor y admin; NO está en páginas públicas). `alert()` → `toast` de `sonner` (`toast.error`/`toast.success`) o un `Notice` en la pantalla.
- Errores: `<p role="alert" className="text-meta font-medium text-danger-ink">` o `Notice tone="danger"`. Texto: qué pasó + cómo arreglarlo, sin disculpas.
- Tablas (solo cuando hay muchas columnas, sobre todo admin): dentro de `Card` con `overflow-x-auto`; cabecera `text-meta font-medium text-ink-3` sin mayúsculas; filas `divide-y divide-line`; en móvil, si la tabla no cabe, considera mostrar una `List` en `sm:hidden` y la tabla en `hidden sm:block`.
- Responsive SIEMPRE: rejillas que empiezan en 1 columna, `flex-wrap`, botones `w-full sm:w-auto` cuando van solos en móvil. Zonas táctiles ≥ 44 px (`h-11`/`min-h-11`).
- Textos en español de España, frase normal (solo primera mayúscula), sin "Clic aquí", sin mayúsculas en títulos de sección, sin emojis. Fechas con `formatLongDate`.
- Sin animaciones nuevas. Quita `motion` decorativo de listas si lo hay (stagger al cargar).
- Accesibilidad: encabezados en orden (un `h1` por pantalla, ya lo pone PageHeader), `aria-pressed` en botones de alternar, `aria-current` en navegación propia, `role="alert"` en errores, `label` en todo control.

## Informe final (máx. 200 palabras)
Archivos tocados, qué no has podido migrar y por qué, y cualquier cambio que necesitarías en un componente compartido.
