# Padel School Manager — Funcionalidades

---

## Panel de Administración (Web)

### Dashboard & Analíticas
- KPIs en tiempo real: alumnos activos, clases hoy, pagos pendientes, materiales publicados
- Alumnos sin pagar del mes con importes y horarios
- Últimos alumnos registrados con acceso directo a su ficha
- Página de analíticas: ingresos totales, desglose por tipo (mensualidad, clase suelta, bono, manual), distribución de alumnos por nivel con gráfico de barras

### Gestión de Alumnos
- Alta individual de alumno o monitor con asignación de nivel inicial
- Importación masiva desde Excel (nombre, email, teléfono, nivel, contraseña)
- Ficha completa por alumno:
  - Datos personales (nombre, email, teléfono, fechas de alta/baja)
  - Inscripciones activas en grupo fijo con estado de pago mensual
  - Historial completo de cambios de nivel con fechas
  - Saldo de bolsa de clases y movimientos detallados
  - Histórico de pagos (tipo, importe, estado, fecha)
  - Faltas registradas y recuperaciones
  - Notificaciones recibidas
- Editar datos personales, estado activo/baja, fechas de alta y baja
- Ajustar saldo de bolsa manualmente con motivo
- Cambiar nivel del alumno

### Gestión de Horarios
- Vista lista y vista calendario semanal de todos los horarios activos
- Crear clase: pista, monitor, nivel requerido (opcional), horario, duración (60/90 min), recurrencia (ninguna / semanal / quincenal) con fecha de fin opcional, aforo máximo
- Ver alumnos inscritos en el próximo turno (grupo fijo + reservas puntuales)
- Editar y eliminar clases

### Inscripciones de Grupo Fijo
- Dar de alta y baja alumnos en clases con recurrencia fija
- Ver estado de pago mensual por inscripción
- Marcar pago de mensualidad manualmente

### Pagos e Ingresos
- Navegación por mes
- Total cobrado, número de transacciones, pendientes de pago del mes seleccionado
- Lista de alumnos sin regularizar con importes y clases asignadas
- Tabla completa de transacciones (tipo, importe, estado, fecha, alumno)

### Niveles de Juego
- CRUD completo de niveles con nombre y color personalizado
- Contador de alumnos activos por nivel

### Materiales Didácticos
- Subir PDFs con título, descripción y asignación por nivel(es) o global
- Estado publicado / borrador
- Editar, previsualizar y descargar materiales

### Pistas e Instalaciones
- Crear, editar y desactivar pistas (tipo interior / exterior)

### Configuración de la Escuela
- Nombre de la escuela
- Precio de clase suelta (60 y 90 min)
- Precio y número de clases por bono (60 y 90 min, configurables independientemente)
- Política de cancelación: horas mínimas previas a la clase para devolución a bolsa
- Pasarela de pago Redsys TPV: código de comercio, clave secreta, terminal, entorno test/producción

### Chat de Soporte
- Bandeja de todas las conversaciones con estado activo / resuelto
- Mensajería en tiempo real con alumnos y monitores
- Previsualización del último mensaje en la bandeja
- Marcar hilo como resuelto o eliminar hilo

### Notificaciones Push
- Enviar a todos los alumnos, por nivel o a alumnos con pago pendiente
- Mensaje personalizado (título + cuerpo hasta 300 caracteres)
- Acciones rápidas: recordatorio de pago, recordatorio de clase

### Gestión Multi-Escuela (Super Admin)
- Gestión de múltiples escuelas desde un único acceso
- Ver plan (trial / basic / pro), número de usuarios y estado de cada club
- Editar configuración individual por escuela
- Datos completamente aislados entre escuelas

---

## Portal de Alumnos (Web)

### Dashboard
- Próxima clase: fecha, hora, duración, pista, estado de pago mensual e importe
- Nivel actual con badge de color
- Saldo de bolsa de clases disponibles
- Acceso rápido a: mis clases fijas, huecos disponibles, bolsa de clases

### Mis Clases Fijas
- Lista de inscripciones activas (horario, pista, monitor, nivel requerido)
- Próximas 8 ocurrencias con fecha por cada clase
- Registrar falta: libera la plaza para otros alumnos (respeta la política de horas configurada)
- Estado de pago del mes (pagado / pendiente) por inscripción

### Reservar Huecos Disponibles
- Dos categorías: huecos por falta de compañero + plazas libres de aforo
- Filtrado automático por nivel del alumno
- Detalle de cada hueco: fecha, hora, duración, pista, monitor, nivel, ocupación actual
- Reservar con un clic usando saldo de bolsa
- Actualización en tiempo real de disponibilidad

### Bolsa de Clases
- Ver saldo disponible en todo momento
- Comprar bonos de 60 o 90 min (precio y cantidad configurados por el admin)
- Precio por clase calculado automáticamente
- Historial de movimientos con fecha, motivo e impacto en saldo
- Pago vía Redsys TPV

### Pago de Mensualidades
- Pagar mes pendiente directamente desde la ficha de la clase o el dashboard
- Pago vía Redsys TPV

### Materiales Didácticos
- Ver y descargar PDFs asignados a su nivel y materiales globales

### Notificaciones
- Centro de notificaciones con marca de leído y eliminación individual

### Chat
- Conversación directa con administración
- Conversación directa con los monitores de sus clases activas

---

## Portal de Monitores (Web)

### Dashboard
- Clases totales asignadas y clases de hoy
- Lista de clases del día con hora, pista, nivel y alumnos inscritos / aforo máximo

### Mis Clases
- Todas las clases asignadas agrupadas por día de la semana
- Barra de ocupación visual por clase
- Acceso al detalle de cada clase

### Detalle de Clase
- Alumnos del grupo fijo con nombre y nivel actual
- Faltas próximas comunicadas por alumno (con fecha)
- Lista de reservas puntuales del día
- Pase de asistencia: marcar presencia o ausencia (✓ / ✗) por alumno

### Materiales Didácticos
- Acceso a todos los PDFs publicados sin filtro de nivel
- Descargar materiales para preparar clases

### Chat
- Conversación directa con administración
- Bandeja de mensajes entrantes de los alumnos de sus clases

---

## Infraestructura y Capacidades Técnicas

- **Multi-tenant desde el día 1** — escala a cualquier número de escuelas sin cambios
- **Tiempo real** en páginas clave: disponibilidad de huecos, panel admin, chat
- **Pasarela Redsys** integrada — la estándar en España para cobros online
- **Sistema de bolsa** con trazabilidad completa de cada movimiento
- **Control de acceso por roles**: super admin / admin / monitor / alumno
- **Importación masiva desde Excel** — onboarding de escuelas existentes sin fricción
- **Diseño 100% responsive** — funciona en móvil, tablet y escritorio
- **100% web** — sin necesidad de instalar ninguna app, accesible desde cualquier dispositivo con navegador

---

## Backlog Post-Lanzamiento

Funcionalidades identificadas en la auditoría pre-producción (2026-06-12), pendientes de priorizar:

- **Exportación a Excel/CSV** — pagos del mes y listado de alumnos desde el panel admin
- **Informe mensual de ingresos** — resumen automático por tipo de pago y clase
- **Audit log** — registro de acciones admin (cambios de nivel, ajustes de bolsa, pagos manuales)
- **Recordatorios por SMS/WhatsApp** — complemento a push para alumnos sin la web abierta
- **Sincronización Google Calendar** — exportar horario de clases del monitor
- **Tipos generados de Supabase** — eliminar `any`s progresivamente con codegen
- **Auditoría de accesibilidad** — aria-labels, contraste, Lighthouse
- **Rate limiting distribuido** — migrar de memoria a Upstash/Redis si Railway escala a varias instancias
- **Registro público de alumnos** — el endpoint `/api/auth/register` se eliminó por estar sin uso y sin protección; si se quiere alta self-service, reimplementar con invitación/captcha
