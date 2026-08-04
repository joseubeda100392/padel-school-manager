# Análisis de valor — Playtomic Third-Party API (Partner API oficial)

> Investigación realizada en agosto 2026 sobre la documentación oficial de `third-party.playtomic.io` (Auth, Bookings, Players, Payments, Conventions) más búsqueda web sobre Playtomic Manager, para decidir qué construir de valor real sobre las credenciales partner ya configuradas (club Vendito Padel).

**Límite real de la API:** es de solo lectura (GET únicamente) en sus 4 categorías documentadas — Auth, Bookings, Players, Payments. No hay endpoints de creación/escritura. Esto descarta escribir nada en Playtomic vía API (crear partidos, añadir jugadores, cerrar reservas), pero abre mucho en analítica, detección y automatización de marketing propio.

---

## 1. Inventario técnico completo de la API

### 1.1 Auth — `POST /api/v1/oauth/token`
- Body: `{ client_id, secret }` → responde `{ token, token_type: "BEARER", expires_in: 3600 }`.
- Token válido 1h.
- Implementado en `PlaytomicOfficialClient.login()` (`apps/web/lib/playtomic.ts`).
- Credenciales se generan en Playtomic Manager → Settings → Developer tools (clubes de cadena las piden a soporte).

### 1.2 Bookings — `GET /api/v1/bookings`
- Filtros: `tenant_id` (obligatorio), `start_booking_date`/`end_booking_date` (obligatorios si no se usa `booking_id`, máx. rango 365 días), `booking_id[]`, `participant_id`, `booking_type`, `sport_id`, `status`, `page`, `size` (máx 200).
- `booking_type`: `REGULAR_BOOKING`, `RECURRING_BOOKING`, `OPEN_MATCH`, `LEAGUE_MATCH`, `PRIVATE_CLASS`, `COURSE_CLASS`, `TOURNAMENT`, `PUBLIC_CLASS`.
- `status`: `PENDING`, `IN_PROGRESS`, `FINISHED`, `CANCELED`.
- Campos de respuesta: `booking_id`, `resource_id`, `resource_name` (pista asignada — clave para detectar "partido sin cerrar"), `participant_info.owner_id`, `participant_info.participants[]` (`participant_type`: GUEST/CUSTOMER/CONTACT), `payment_status` (UNPAID/PARTIAL_PAID/PAID/PENDING/REFUNDED/VOID/NOT_APPLICABLE), `is_canceled`.
- Implementado como diagnóstico en `getVenueBookingsSample()` (`lib/playtomic.ts`), filtrando `booking_type=OPEN_MATCH`.

### 1.3 Players — `GET /api/v1/venues/{venue_id}/players` (+ single player)
- Paginación por cursor (`cursor_id`, `has_more`, `next_cursor_id`), `limit` máx. 100.
- `include`: `BENEFITS`, `SPORTS`, `WALLETS` (sin esto no trae nivel).
- Campos: `player_id`, `name`, `email`, `phone`, `birth_date`, `gender`, `last_registration_date`, `accepts_commercial_communications`, `sports[]` (`sport_id`, `level_value` — nivel real de pádel), `benefits[]`, `wallets[]`.
- Implementado en `getVenuePlayers()` / `getVenuePlayersSample()`.

### 1.4 Payments — `GET /api/v1/payments`
- Filtros: `tenant_id` (obligatorio), `start_service_date`/`end_service_date` **o** `start_payment_date`/`end_payment_date` (no combinables entre sí), máx. 13 meses, `cursor_id`, `limit` máx. 100. Devuelve solo pagos `PAID`/`REFUNDED`.
- Campos clave: `payment_info.payment_type` (`SINGLE` vs `SPLIT`), `payment_info.total`/`subtotal`/`taxes`, `payment_info.payment_method_type`, `payment_info.b2b_commission_info` (comisión de Playtomic: `rate`, `amount`, `tax_amount`), `payment_info.net_transfer_amount` (neto real del club), `product_info` (sport, SKU, categoría, descuento, campaña), `payout_info` (liquidaciones), `user_info`.
- No implementado todavía en código.

### 1.5 Convenciones transversales
- Paginación: por página (sin metadata de total) o por cursor (`has_more`/`next_cursor_id`), según endpoint.
- `last_modified`: timestamp de cuándo se generó el dato cacheado.
- **Rate limit**: 400 peticiones / 10 min, backoff exponencial recomendado 1s→2s→4s→8s→16s ante 429. Implementado en `fetchWithRetry()`.
- Bloqueo heurístico adicional por "patrones sospechosos" sin previo aviso — motivo por el que la API oficial es mucho más segura que la consumer (que ya bloqueó al club una vez).
- Multi-club: "Organización" (cadena de clubes) existe como concepto en Playtomic, pero no hay endpoints de organización documentados — solo se opera por `venue_id`/`tenant_id` individual.

---

## 2. Qué ya hace Playtomic Manager de forma nativa (para no duplicar)

- **Dashboard y Billing**: secciones propias de Manager para ver rendimiento de pistas e ingresos online en tiempo real.
- **Reports**: descarga de listado de pagos con detalle — prácticamente lo mismo que devuelve `GET /payments`.
- **CRM propio**: gestión de reservas, membresías, pagos, eventos y CRM — acotado a jugadores de Playtomic, sin el concepto de matrícula/nivel de clase/bolsa de la escuela.
- La propia documentación de Playtomic dice que la API existe para integrar con "CRMs, herramientas de marketing, plataformas de fidelización o software de gestión de instalaciones" — el fabricante espera y facilita este tipo de capa de terceros.

**Conclusión:** no vender "un dashboard de ingresos de Playtomic" replicado — ya existe en Manager. El valor real está en cruzar sus datos con los internos de PSM.

### 2.1 Cierre automático de partidos abiertos — cómo funciona de verdad

- **4 jugadores apuntados** → pista reservada y partido confirmado al instante.
- **3 jugadores apuntados** → se reserva solo si quedan más de 4h para el inicio.
- **2 jugadores apuntados** → se reserva solo si quedan más de 12h para el inicio.
- Si no se llega a esos mínimos a tiempo, **Playtomic cancela el partido automáticamente y reembolsa**.

Playtomic ya decide y ejecuta el cierre/cancelación por sí solo, con umbrales de tiempo conocidos. No hay ninguna acción de "cerrar partido" que se pueda ni deba automatizar vía API (que además es de solo lectura). Lo que Playtomic no hace es buscar activamente más jugadores — simplemente espera. Ahí está el hueco real de automatización para PSM (ver idea A).

**Fuentes:**
- [Brief introduction to Playtomic Manager](https://helpmanager.playtomic.com/hc/en-gb/articles/20535516949009-Brief-introduction-to-Playtomic-Manager)
- [Revenues reports – Playtomic Manager](https://helpmanager.playtomic.com/hc/en-gb/articles/20534995597841-Revenues-reports)
- [Playtomic Manager - Racket club management software](https://playtomic.com/playtomic-manager)
- [Cómo gestionar partidos abiertos en Playtomic Manager](https://helpmanager.playtomic.com/hc/es/articles/20534737902353-C%C3%B3mo-gestionar-partidos-abiertos-en-Playtomic-Manager)
- [¿Cuándo se reserva o cancela un Partido Abierto de Playtomic?](https://helpmanager.playtomic.com/hc/es/articles/20535700374929--Cu%C3%A1ndo-se-reserva-o-cancela-un-Partido-Abierto-de-Playtomic)

---

## 3. Ideas de valor concretas

### A. Pista Viva 2.0 — Motor de reclutamiento automático para partidos a punto de caerse
No se trata de "cerrar" el partido (eso lo hace Playtomic solo, ver 2.1) sino de subir la probabilidad de que llegue a 3-4 jugadores antes del corte:

1. Cruzar `GET /bookings?booking_type=OPEN_MATCH` con `resource_id` vacío/nulo + `participant_info.participants[]` → partidos con 1-2 jugadores y poco margen antes del corte (12h si hay 2, 4h si hay 3).
2. Cruzar el nivel del partido con `sports[].level_value` de los alumnos (vía Players) para elegir a quién avisar.
3. Notificación automática (push/WhatsApp) a alumnos del nivel adecuado con el enlace directo del partido en Playtomic, para que se apunten y paguen ellos mismos (split payment nativo, sin que PSM toque dinero ni reservas).
4. El cierre real lo ejecuta Playtomic en cuanto entra el jugador — PSM solo acelera que pase antes del corte.

**Valor de venta:** partidos que hoy se cancelan solos por falta de jugadores pasan a tener una campaña de recuperación automática — más pistas ocupadas, más facturación, sin trabajo manual del club.

### B. Vista financiera unificada Playtomic + PSM
Unir `GET /payments` (ingresos de Playtomic: partidos sueltos, `SPLIT` vs `SINGLE`, comisión de Playtomic, `net_transfer_amount`) con los ingresos internos de PSM (Redsys, bolsa de clases, matrículas) en una sola vista de facturación total del club — algo que ni Playtomic ni ningún otro sistema puede dar porque ninguno ve ambos lados a la vez.

**Valor de venta:** el dueño del club deja de saltar entre Playtomic Manager y PSM para saber cuánto factura de verdad.

### C. CRM enriquecido — conversión de jugador Playtomic → alumno
Con `sports[].level_value`, `last_registration_date` y cruce de email con la tabla `users` (patrón ya usado en `import-players`):
- Detectar jugadores que ya juegan en el club por Playtomic pero no son alumnos → leads calientes ya dentro del club físico.
- Proponer nivel de clase con datos reales de Playtomic, no autodeclarado.
- Detectar alumnos actuales que también juegan partidos sueltos fuera de clase (señal de upsell).

**Valor de venta:** conversión de jugador ocasional en alumno recurrente — exclusivo de PSM, Manager no tiene el concepto de matrícula.

### D. Analítica de ocupación real por tipo de reserva (complementaria)
`booking_type` permite ver qué franjas están sistemáticamente vacías fuera de las clases propias — insumo para decidir en qué horas lanzar las campañas del punto A.

### E. Reconciliación automática de estado de pago (nicho)
`payment_status` en Bookings permite detectar partidos con problemas de cobro sin mirar Manager a mano.

---

## 4. Qué NO se puede hacer

- No crear, modificar ni cancelar reservas/partidos vía API — todo es GET.
- No iniciar cobros ni pagos.
- No hay webhooks documentados — todo es polling.
- No hay endpoint de disponibilidad/huecos libres en tiempo real dentro de esta API (eso sigue siendo cosa de la API consumer, la que bloqueó al club).
- No hay gestión de organización/cadena vía API documentada.

---

## 5. Priorización recomendada

| # | Idea | Esfuerzo | Depende de | Valor |
|---|---|---|---|---|
| A | Motor de reclutamiento automático (partidos a punto de caerse) | Medio — detección ya en marcha, falta lógica de umbral horario + envío de notificaciones | Confirmar shape real de `bookings` en producción, nivel de alumnos cargado | Muy alto — objetivo de negocio directo |
| B | Vista financiera unificada Playtomic + PSM | Medio | Cliente ya autenticado + datos internos de Redsys/bolsa | Alto — diferenciador real |
| C | CRM enriquecido / leads de jugadores no-alumnos | Medio | Reusar `import-players`, cruzar con `users` | Alto, requiere UX de "convertir lead en alumno" |
| D | Mapa de ocupación por tipo de reserva | Medio-alto | Bookings histórico, más volumen de llamadas | Medio, a medio plazo |
| E | Reconciliación de payment_status | Bajo | Bookings | Bajo-medio, nicho |

**Recomendación:** empezar por A — es el objetivo de negocio pedido directamente y ya hay base técnica (diagnóstico, cliente oficial, nivel de jugadores). B es el siguiente paso natural porque no compite con nada de Manager y usa datos que hoy nadie unifica.

---

## 6. Estado técnico actual

- `PlaytomicOfficialClient` (`apps/web/lib/playtomic.ts`) implementa `login()`, `getVenuePlayers()`, `getVenuePlayersSample()`, `getVenueBookingsSample()`.
- Endpoint de diagnóstico de solo lectura: `apps/web/app/api/admin/playtomic/diagnostic` (login + muestra de jugadores con nivel + partidos OPEN_MATCH de los próximos 14 días, sin escribir nada en BBDD).
- Endpoint de importación real (con escritura): `apps/web/app/api/admin/playtomic/import-players`, con modo `?dry_run=1` para previsualizar sin crear usuarios.
- UI de ambos en Ajustes → Playtomic (`apps/web/app/dashboard/settings/settings-client.tsx`).
- Credenciales partner reales configuradas para el club Vendito Padel (`client_id`, `client_secret`, `tenant_id` en `clubs`).

**Pendiente antes de construir la idea A:** confirmar en producción el shape real de la respuesta de `GET /bookings` (el documentado puede diferir en detalles no cubiertos por la doc pública) usando el diagnóstico ya desplegado.
