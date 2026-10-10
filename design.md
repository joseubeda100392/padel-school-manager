# Design — ePadel School

Sistema de diseño fijo de la app. Toda pantalla nueva o rediseñada se construye
con estos tokens y con los componentes de `apps/web/components/ui`. No se
inventan colores, tamaños ni sombras por pantalla: si falta algo, se añade aquí
y en los tokens, y luego se usa.

## Qué es el producto

Una app que se usa desde el navegador del móvil (se instala en la pantalla de
inicio). Alumnos y monitores la usan casi siempre en el móvil, con prisa, entre
clases. El admin del club la usa en móvil y en ordenador para gestionar
alumnos, clases y cobros. Quien decide si paga es el dueño del club: tiene que
verla y pensar "esto es una herramienta seria".

- **Tono:** utilitario y preciso, con carácter de club. Ni juguetón ni corporativo.
- **Genre (hallmark):** modern-minimal, adaptado a app.
- **Referencias de sensación:** la calma de Linear y la claridad de una app de
  banco moderna, en el idioma visual de una pista de pádel.

## Firma: las líneas de pista

El elemento propio de la app son las **líneas de pista**: trazos finos y rectos
como el marcaje de una pista de pádel. Se usan con moderación y siempre con
sentido:

- La tarjeta de **próxima clase** se dibuja como una pista vista desde arriba:
  un rectángulo con la línea de saque y la línea central.
- El **calendario** usa líneas finas en lugar de celdas con fondo.
- Los **separadores de sección** son una línea fina con el título encima, nunca
  tarjetas apiladas sin jerarquía.

Nada más es decorativo: sin degradados, sin manchas de color, sin brillos ni
cristal.

## Color

Se mantienen los colores de marca (verde pista y azul noche). Lo que cambia es
cómo se usan, para que todo cumpla contraste AA.

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `canvas` | `#F2F5F8` | Fondo de la app | — |
| `surface` | `#FFFFFF` | Tarjetas, hojas, cabecera | — |
| `surface-2` | `#F6F8FA` | Relleno suave: filas alternas, campos en reposo | — |
| `line` | `#E2E8EF` | Bordes de tarjetas y separadores | decorativo |
| `line-strong` | `#8496A9` | Borde de campos de formulario | 3,0:1 (no-texto AA) |
| `ink` | `#0E1C2C` | Texto principal y títulos | 17,2:1 |
| `ink-2` | `#3A4D61` | Texto secundario | 8,7:1 |
| `ink-3` | `#566A7F` | Metadatos y ayudas; el texto más claro permitido | 5,6:1 |
| `accent` | `#00C49A` | Verde de marca: fondo de la acción principal | — |
| `on-accent` | `#0E1C2C` | Texto sobre verde (nunca blanco: daría 2,2:1) | 7,7:1 |
| `accent-hover` | `#19D3AA` | Botón principal al pasar/pulsar | 9,0:1 |
| `accent-ink` | `#00765B` | Verde para texto, enlaces e iconos activos sobre claro | 5,6:1 |
| `accent-soft` | `#E2F7F0` | Fondo de estados positivos y selección | 5,0:1 con accent-ink |
| `warn-ink` / `warn-soft` | `#9A4A06` / `#FDF1DC` | Avisos: pendiente de pago, plazas casi llenas | 5,6:1 |
| `danger-ink` / `danger-soft` | `#B42318` / `#FDECEA` | Errores y acciones destructivas | 5,8:1 |
| `chrome` | `#0E1C2C` | Menú lateral (ordenador) y pantalla de login | — |
| `chrome-2` | `#152434` | Elemento activo dentro del menú | — |
| `chrome-line` | `#22364D` | Separadores dentro del menú | decorativo |
| `chrome-ink` | `#E8EEF4` | Texto del menú | 15:1 |
| `chrome-ink-2` | `#9DB0C3` | Texto secundario del menú | 7,7:1 |
| `focus` | `#00765B` | Anillo de foco (2 px + 2 px de separación) | 5,6:1 |

Reglas:
- **Un solo color de acción:** el verde. Un solo botón principal por pantalla.
- Prohibido el texto blanco sobre verde y el texto `gray-400`/`gray-300`.
- Los colores de estado siempre van con icono o palabra, nunca solos.
- Los **niveles** de los alumnos se muestran con un punto de su color y el
  nombre en `ink`, no como pastillas de colores saturados.
- No se usa ningún otro color de Tailwind suelto (azul, naranja, rosa, morado…).

## Tipografía

- **Display:** Sora 600, tracking `-0.02em`. Solo títulos de pantalla y cifras
  grandes (saldo, importes). Nunca en cursiva.
- **Texto:** DM Sans 400/500/600.
- **Cifras:** siempre `tabular-nums` en importes, horas, saldos y tablas.

| Rol | Tamaño / línea | Peso |
|---|---|---|
| `display` | 32/36 | Sora 600 |
| `title` | 22/28 | Sora 600 |
| `heading` | 17/24 | DM Sans 600 |
| `body` | 15/22 | DM Sans 400 |
| `label` | 14/20 | DM Sans 500 |
| `meta` | 13/18 | DM Sans 400, `ink-3` |

Mínimo 13 px para metadatos y 15 px para texto. Los campos de formulario usan 16 px
para que iOS no haga zoom.

## Espaciado, radios y sombras

- Escala de 4 px: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48.
- Margen lateral de pantalla: 16 px en móvil y 32 px en ordenador.
- Radios: campos y botones 10 px · tarjetas 14 px · hojas 20 px arriba · chips y
  avatares, completos.
- Sombras: solo dos. `shadow-card` (casi imperceptible, separa tarjeta de
  fondo) y `shadow-overlay` (hojas, menús y avisos flotantes). Nada más.

## Estructura de la app

- **Móvil (alumno, monitor y admin):** cabecera fija arriba (título de pantalla,
  volver en las de detalle, campana) y **barra de pestañas abajo**, con 4
  accesos y "Más". Las acciones principales van en una barra fija abajo,
  encima de la barra de gestos.
- **Ordenador:** menú lateral `chrome` agrupado por secciones, y contenido con
  un ancho máximo de 1120 px, en una o dos columnas según la pantalla.
- **Confirmaciones y formularios cortos:** hoja que sube desde abajo en el
  móvil y ventana centrada en el ordenador. Nunca `confirm()` ni `alert()`.
- **Listas:** filas con separadores finos, no una tarjeta por elemento.
- **Vacíos:** frase que explica qué falta y botón para resolverlo.
- **Carga:** esqueletos con la forma del contenido, nunca pantallas en blanco
  ni spinners a pantalla completa.

## Movimiento

- Curvas: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` y
  `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`.
- Pulsar un elemento: `scale(0.97)` en 120 ms.
- Hojas: entrada en 320 ms con `ease-drawer` y salida más rápida; se cierran
  deslizando hacia abajo.
- Avisos: 200 ms. Cambio de pantalla: fundido de 150 ms, sin desplazamiento.
- Ninguna animación en acciones repetidas (filtros, pestañas, teclado).
- Con "reducir movimiento" activado, solo se mantienen los fundidos.

## Iconos

Lucide, trazo 1.75, tamaños de 16, 20 y 24 px. Ningún emoji en la interfaz.

## Texto

Español de España, frases cortas, en mayúscula solo la primera letra.
Los botones dicen lo que hacen ("Pagar 46 €", "Apuntarme"), y el aviso de
después usa el mismo verbo ("Pagado", "Te has apuntado"). Los errores dicen qué
ha pasado y cómo arreglarlo, sin disculparse.

## Accesibilidad

- Contraste AA en todo: texto ≥ 4,5:1 y bordes de controles ≥ 3:1.
- Foco visible con `:focus-visible` en todo lo interactivo; aparece al instante.
- Zonas táctiles de 44 × 44 px como mínimo y 8 px de separación entre ellas.
- Etiquetas visibles en los campos (el texto de ejemplo no sustituye a la
  etiqueta) y errores debajo del campo, anunciados por los lectores de pantalla.
- Iconos sin texto con `aria-label`. Encabezados en orden.
- Respeto de "reducir movimiento" y de las zonas seguras (muesca y barra de gestos).
