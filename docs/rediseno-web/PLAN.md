# Rediseño web de ePadel School: plan

Rama: `rediseno-web` (sale de `v2.1`, la versión en producción el 10 de octubre de 2026).
Volver atrás en cualquier momento: `git checkout v2.1`.

Revisado con las skills de diseño del proyecto (en el punto 0 se explica cuáles sirven para una app y para qué). Base: capturas reales de producción (login, alumna y monitor de la demo X7 PINTO, en móvil y escritorio) y mediciones sobre el código.

## 0. Punto de partida: es una app, no una web

ePadel School es una **app que se usa desde el navegador del móvil**: se instala en la pantalla de inicio y se abre sin barra del navegador. Alumnos y monitores la usan casi siempre en el móvil; el admin, en móvil y en ordenador. Por eso el listón no es "una web bonita", sino que **se sienta como una app nativa**: navegación con pestañas abajo, hojas que suben desde abajo en lugar de ventanas centradas, respuesta inmediata al tocar, respeto de la muesca y la barra de gestos, y cero saltos al cargar.

### Qué skills sirven para esto

| Skill | ¿Sirve? | Para qué se usa |
|---|---|---|
| **ui-ux-pro-max** | Sí, la principal | Sus reglas están escritas para apps: zonas táctiles de 44 px, barra inferior de máximo 5 pestañas, zonas seguras, respuesta al pulsar, estados de carga y error, contraste. Es el checklist de cada pantalla |
| **apple-design** | Sí, muy útil | Gestos, hojas que suben desde abajo, animaciones con física, tipografía y materiales al estilo iOS. Es la que da el "tacto" de app nativa |
| **emil-design-eng** | Sí | Detalle de interacción: botones que responden al pulsar, hojas deslizables, avisos, tiempos y curvas de animación |
| **web-design-guidelines** | Sí, para revisar | Revisión final de accesibilidad y buenas prácticas web, archivo por archivo |
| **vercel-react-best-practices** | Sí, para rendimiento | Que la app cargue y responda rápido en móviles normales |
| **hallmark** | En parte | Pensada sobre todo para webs y landings (portada, secciones, pie). De ella se usan las reglas anti-"diseño genérico", el sistema de tokens, `design.md` y los 8 estados de cada componente. Su parte de estructura de página solo se aplica al login y a las páginas públicas |
| **frontend-design** | En parte | La forma de decidir una dirección visual propia y no genérica. Sus pautas de portada y web de marketing no aplican a las pantallas internas |

### Qué cambia en el plan por ser app

- **Barra de pestañas abajo** para alumno y monitor (4 accesos + "Más"); el admin, con la barra en móvil y el menú lateral en ordenador.
- **Hojas inferiores** (se cierran deslizando hacia abajo) para confirmar pagos, apuntarse a un hueco, registrar una falta… en lugar de ventanas centradas y de los `confirm()` del navegador.
- **Cabecera fija** de app, con título de pantalla y botón de volver en las pantallas de detalle.
- **Botón de acción fijo abajo** en pantallas con una acción principal (pagar, apuntarse), por encima de la barra de gestos.
- **Respuesta al tocar** en todo lo pulsable, sin el retardo ni el resaltado azul del navegador.
- **Esqueletos de carga** y transiciones cortas entre pantallas, para que no "parpadee" como una web.
- **Instalación y estado sin conexión** cuidados: pantalla de arranque, iconos y un aviso claro si no hay red.

## 1. Por qué no parece profesional

El color de marca y las fuentes (Sora y DM Sans) están bien. El problema es que **no hay un sistema de diseño**: cada pantalla se ha montado a mano con clases sueltas, y esa falta de coherencia es lo que se nota.

| Hallazgo | Dato | Qué se percibe |
|---|---|---|
| Sin componentes comunes | Solo hay 2 en `components/ui`. La tarjeta blanca está copiada 152 veces y el botón verde 59 | Cada pantalla es un poco distinta: radios, sombras, márgenes y tamaños cambian |
| Colores sin control | 507 usos de colores sueltos de Tailwind (azul, naranja, rosa, ámbar…) y 55 colores en hexadecimal | Naranja en huecos, azul en niveles, rosa en infantil, verde en todo: no hay jerarquía |
| Emojis como iconos | 121 emojis en 46 pantallas ("💳 Pagar mi plaza", "👋", "🗓") | Aspecto de prototipo. Se ven distintos en cada móvil |
| Sin foco de teclado | 0 usos de `focus-visible`; 464 estilos de foco hechos a mano | Accesibilidad pobre; con teclado no se sabe dónde estás |
| Diálogos del navegador | 34 `confirm()` y `alert()` | Ventanas grises del sistema en mitad de la app |
| Texto pequeño y gris claro | 593 `text-xs`, 15 de 10–11 px, mucho `gray-400` | Cuesta leer en el móvil y parece apagado |
| Jerarquía plana | En la portada del alumno lo primero son sus "Datos personales"; todas las tarjetas pesan igual | No queda claro qué es lo importante (la próxima clase) |
| Escritorio medio vacío | El contenido ocupa unos 670 px y deja la mitad derecha en blanco | Parece una web de móvil estirada |
| Navegación sobrecargada | El alumno tiene 12 opciones en el menú; en móvil, todo detrás de la hamburguesa | Cuesta encontrar lo básico; no parece una app |
| Aviso de notificaciones encima del contenido | En móvil tapa la tarjeta "Mis clases" | Parece un fallo |
| Botones desactivados verde claro | "Activar avisos" y "Actualizar contraseña" | Parecen rotos, no desactivados |
| Calendario | Burbujas naranjas "1" montadas sobre el número del día, sin leyenda; celdas enormes en escritorio | No se entiende qué significa cada marca |
| Carga | 3 spinners y 1 esqueleto en toda la app | Saltos al cargar |
| Detalles | Título de pestaña "Panel Admin" también para alumnos; "Lunes, 12 **De** Octubre" | Descuido |

Lo que **ya está bien** y se conserva: el logo, el verde de marca, el login (es lo mejor de la app), el menú lateral oscuro como idea y la estructura de rutas. No se toca ninguna lógica, ruta ni dato.

## 2. Dirección visual (decisión tuya)

Las tres respetan logo y verde de marca. Cambia la personalidad.

**A · "Pista" (recomendada).** Superficies claras y limpias, texto en el azul marino del club en lugar de gris, y el verde como **único** color de acción. Elemento propio: las **líneas de pista** (trazos finos como el marcaje de una pista de pádel) para separar secciones, enmarcar la tarjeta de próxima clase y dibujar el calendario. Escritorio con menú lateral claro y contenido a dos columnas. Estilo Linear/Stripe, pero de pádel.

**B · "Club nocturno".** Mantiene el menú lateral azul noche actual y lo refina: menos colores, componentes comunes, mejor tipografía. Menos cambio visual, menos riesgo, menos efecto "nuevo".

**C · "Deportivo".** Más carácter: titulares en tipografía condensada deportiva (tipo marcador), números grandes para saldo y clases, más contraste. Llama más la atención, pero también se cansa antes.

Otras decisiones:
- **Modo oscuro:** recomiendo no hacerlo en esta fase; duplica el trabajo de revisión. Se puede añadir después porque todo irá con tokens.
- **Bottom bar en móvil** para alumno y monitor (4 accesos + "Más"), como una app nativa. Recomendado.

## 3. Plan por fases

Cada fase se hace en `rediseno-web`, se revisa con capturas en móvil (375 px) y escritorio (1440 px) y se prueba en la demo X7 PINTO antes de pasar a la siguiente. Nada llega a `master` hasta que des el visto bueno al conjunto.

| Fase | Qué | Resultado visible | Tamaño |
|---|---|---|---|
| 0 · Sistema | `design.md` con la dirección elegida. Tokens en `tailwind.config` y `globals.css`: colores con significado (superficie, texto, acción, éxito, aviso, error), escala tipográfica, espaciado, radios, sombras, movimiento, números tabulares. Página interna `/dev/design` con todos los componentes | Nada todavía para el usuario | 1 día |
| 1 · Componentes | `Button`, `Card`, `Badge`, `Field`/`Input`/`Select`, `Sheet` (hoja inferior en móvil, ventana en ordenador; sustituye a `confirm`/`alert`), `Toast`, `AppBar`, `TabBar`, `StickyAction`, `Skeleton`, `EmptyState`, `PageHeader`, `StatTile`, `DataTable`, `Tabs`, `Calendar`. Todos con estados de foco, pulsado, desactivado, cargando y error. Iconos Lucide en lugar de emojis | Nada todavía para el usuario | 2–3 días |
| 2 · Estructura | Menús de alumno, monitor y admin rehechos: bottom bar en móvil, menú agrupado por secciones, cabecera con el club, aviso de notificaciones como banner que no tapa nada, título de pestaña correcto | Cambia toda la app de golpe | 1–2 días |
| 3 · Alumno | Portada centrada en la próxima clase y el saldo; Mis clases, Huecos, Bolsa, Pagos, Perfil. Calendario con leyenda clara | Lo que más ve la gente | 2–3 días |
| 4 · Monitor | Portada, Mis clases (semana), detalle de clase con asistencia, calendario maestro | | 1–2 días |
| 5 · Admin | Panel, Clases, Alumnos (ficha y tabla), Pagos, Configuración (hoy 1.622 líneas: se divide en pestañas), Analítica | Lo que ve el cliente cuando decide si paga | 3–5 días |
| 6 · Público | Login, recuperar contraseña, páginas legales, imagen para compartir enlaces, iconos de la app | Primera impresión | 1 día |
| 7 · Control de calidad | Capturas en 320/375/768/1440, contraste AA, teclado, movimiento reducido, Lighthouse; prueba completa en X7 PINTO; merge a `master` y etiqueta `v3.0` | | 1–2 días |

**Total orientativo:** 2,5–3,5 semanas de trabajo. Las fases 0–3 (unas 1,5 semanas) ya cambian la percepción de la app para alumnos y se pueden enseñar a X7 y R3.

## 4. Reglas que se aplican en todas las fases

- Un solo color de acción (el verde). Los demás colores solo con significado: rojo error, ámbar aviso, verde éxito. Los niveles van con un punto de color y su nombre, no con pastillas de colores chillones.
- Un solo botón principal por pantalla.
- Ningún emoji como icono. Iconos Lucide del mismo grosor.
- Texto mínimo de 14 px en la interfaz (16 px en campos de formulario en móvil) y contraste AA.
- Zonas táctiles de 44 px como mínimo.
- Movimiento corto (150–250 ms), solo donde explica algo: abrir un diálogo, confirmar una acción. Nada en acciones repetidas, y respeto a "reducir movimiento".
- Esqueletos de carga en lugar de saltos.
- Todo responsive como ahora: tablas con scroll horizontal, rejillas que empiezan en una columna.

## 5. Cómo revisarlo sin tocar producción

- **Opción 1 (recomendada):** un entorno de Railway para la rama `rediseno-web` con su propia URL, para que lo veas desde el móvil y puedas enseñarlo.
- **Opción 2:** en local con `pnpm dev`.

En ambos casos la app usa la **misma base de datos de producción**, porque no hay otra. Las fases del rediseño no cambian datos, pero al probar hay que hacerlo en la demo X7 PINTO, nunca en R3.

## 6. Lo que necesito de ti para arrancar

1. Dirección visual: **A**, B o C.
2. ¿Bottom bar en móvil? (recomendado: sí)
3. ¿Modo oscuro ahora o más adelante? (recomendado: más adelante)
4. Entorno de revisión: ¿te creo uno en Railway para la rama o lo vemos en local?
5. Para revisar el panel de admin necesito un admin de prueba en X7 PINTO. Ahora mismo solo hay alumnos y monitores ficticios, y el admin de la demo es una persona real.
