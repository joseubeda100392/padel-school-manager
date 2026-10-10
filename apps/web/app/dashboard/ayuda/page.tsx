import { TriangleAlert, Info } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { Notice } from "@/components/ui/feedback"

const NAV_ITEMS = [
  { id: 'que-es',          label: '¿Qué es?' },
  { id: 'usuarios',        label: 'Usuarios' },
  { id: 'tambien-alumno',  label: 'Monitor + alumno' },
  { id: 'niveles',         label: 'Niveles' },
  { id: 'clases',          label: 'Clases y horarios' },
  { id: 'sustituto',       label: 'Sustituto de monitor' },
  { id: 'validacion',      label: 'Validación de clases' },
  { id: 'horas',           label: 'Horas de monitores' },
  { id: 'pista-viva',      label: 'Pista Viva' },
  { id: 'torneos',         label: 'Torneos' },
  { id: 'pagos',           label: 'Pagos' },
  { id: 'descuentos',      label: 'Descuentos en cuota' },
  { id: 'materia',         label: 'Materia' },
  { id: 'chat',            label: 'Chat soporte' },
  { id: 'notificaciones',  label: 'Notificaciones' },
  { id: 'configuracion',   label: 'Configuración' },
  { id: 'faq',             label: 'Preguntas frecuentes' },
]

export default function AdminAyudaPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="Ayuda" description="Guía completa del panel de administración." />

      <div className="lg:grid lg:grid-cols-[1fr_200px] lg:items-start lg:gap-8">

        <div className="space-y-6">
          <Section id="que-es" title="¿Qué es este panel?">
            <p>Es el centro de control del club: alumnos y monitores, horarios y clases, pagos, materia didáctica, torneos y toda la configuración del club. Lo que actives o desactives aquí se refleja al instante en las apps de alumnos y monitores.</p>
          </Section>

          <Section id="usuarios" title="Usuarios (alumnos y monitores)">
            <p>Desde <strong>Usuarios</strong> gestionas tanto alumnos como monitores — están en el mismo listado, con pestañas para filtrar por rol. Al entrar en la ficha de una persona puedes:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Editar sus datos, rol, fechas de alta/baja y estado activo/inactivo.</li>
              <li>Cambiar su email de acceso.</li>
              <li>Si es alumno: ver y gestionar sus clases fijas, cuota, bolsa, nivel, pagos e historial.</li>
              <li>Si es monitor: ver sus clases asignadas y su tarifa por hora.</li>
              <li>Desactivar o eliminar el usuario (desactivar conserva su historial; eliminar solo lo pueden hacer super admins y borra los datos de forma permanente).</li>
            </ul>
            <Nota><strong>Importar alumnos:</strong> desde "Importar Excel" en el listado puedes dar de alta varios alumnos a la vez subiendo una hoja de cálculo con el formato del club.</Nota>
          </Section>

          <Section id="tambien-alumno" title="Un monitor que también es alumno">
            <p>Si una misma persona da clases como monitor y además juega como alumno, no hace falta crear dos cuentas. En su ficha (con rol Monitor), marca el check <strong>"También es alumno"</strong>.</p>
            <p className="mt-2">A partir de ahí, esa persona entra con un único usuario y puede cambiar entre el panel de Monitor y el de Alumno desde un enlace en su propio menú lateral. Además, aparecerá como candidato al inscribirlo en una clase fija, igual que cualquier alumno, y en el listado de Usuarios se le ve un distintivo <strong>"+ Alumno"</strong> junto a su rol.</p>
            <Aviso>Si esta persona ya tenía una cuenta de alumno antigua separada (por ejemplo, de antes de ser monitor), hay que fusionar los datos a mano — contacta con soporte técnico para no perder su historial de inscripciones.</Aviso>
          </Section>

          <Section id="niveles" title="Niveles">
            <p>Define los niveles de juego del club (nombre, color, orden). Se usan para clasificar alumnos, filtrar materia didáctica, avisos de huecos libres y las clases fijas.</p>
          </Section>

          <Section id="clases" title="Clases y horarios">
            <p>Desde <strong>Clases</strong> creas y gestionas los horarios fijos del club: pista, monitor, nivel, hora de inicio/fin, plazas máximas y recurrencia.</p>
            <p className="mt-2">Dentro de cada clase puedes:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Inscribir o quitar alumnos del grupo fijo.</li>
              <li>Ver y gestionar reservas puntuales (bolsa de clases o huecos libres).</li>
              <li>Registrar faltas de alumnos, publicándolas o no como hueco libre para otros.</li>
              <li>Cambiar la hora solo para un día concreto (pista no disponible, etc.), sin tocar el horario habitual.</li>
              <li>Cancelar una sesión puntual completa (ej. festivo no marcado), lo que devuelve el crédito a la bolsa de los alumnos afectados.</li>
            </ul>
            <p className="mt-3"><strong>Calendario maestro</strong> (dentro de Clases) muestra toda la semana del club de un vistazo, con monitor, nivel y alumnos de cada franja.</p>
          </Section>

          <Section id="sustituto" title="Sustituto de monitor para un día">
            <p>Si el monitor habitual de una clase no puede dar clase un día concreto, entra en esa clase y pulsa <strong>"Poner un sustituto solo el [fecha]"</strong>, junto al cambio de hora puntual. Elige el monitor sustituto y guarda.</p>
            <Steps items={[
              'Entra en la clase afectada.',
              'Pulsa "Poner un sustituto solo el [fecha]".',
              'Elige el monitor que la va a dar ese día y, opcionalmente, el motivo.',
              'Guarda.',
            ]} />
            <p className="mt-2">El monitor habitual no cambia para el resto de la temporada — solo ese día. En "Horas de monitores", ese día pasa a contar para el sustituto, no para el titular. Se avisa por push a ambos.</p>
          </Section>

          <Section id="validacion" title="Validación de clases">
            <p>Módulo opcional (solo si tu club lo tiene activado en Configuración). Cada monitor marca desde su panel, el mismo día, si ha dado su clase o no, y qué alumnos han faltado. Desde <strong>Validación de clases</strong> confirmas cada sesión marcada — hasta que la confirmas, no cuenta ni para las horas del monitor ni para su nómina.</p>
            <p className="mt-2">Desde la misma pantalla puedes fijar la tarifa por hora de cada monitor y marcar sus horas pendientes como pagadas.</p>
          </Section>

          <Section id="horas" title="Horas de monitores">
            <p>Si tu club <strong>no</strong> usa Validación de clases, esta pantalla te muestra igualmente cuántas horas ha dado cada monitor este mes — calculado automáticamente a partir de su horario fijo, sin que nadie tenga que marcar nada. Se reinicia solo cada mes.</p>
            <p className="mt-2 text-ink-3">Tiene en cuenta los festivos del club, las sesiones canceladas y los sustitutos puntuales.</p>
          </Section>

          <Section id="pista-viva" title="Pista Viva">
            <p>Módulo opcional que detecta partidos abiertos en Playtomic a los que les faltan jugadores, y avisa a los alumnos del club con el nivel adecuado que se han apuntado (opt-in) a este servicio.</p>
            <p className="mt-2">Requiere configurar las credenciales de la API oficial de Playtomic del club en Configuración. Desde el panel de <strong>Pista Viva</strong> ves los partidos detectados y la tasa de adopción entre tus alumnos.</p>
          </Section>

          <Section id="torneos" title="Torneos">
            <p>Módulo opcional para crear torneos, abrir inscripciones y gestionar participantes desde la app.</p>
          </Section>

          <Section id="pagos" title="Pagos">
            <p>Listado de todos los cobros del club: cuotas fijas, bonos, clases sueltas, torneos y domiciliaciones. Filtra por mes y por estado (cobrado, pendiente, fallido).</p>
            <Nota>El cobro con tarjeta se gestiona con Redsys (TPV virtual). Los datos bancarios de los alumnos nunca se guardan en la aplicación.</Nota>
          </Section>

          <Section id="descuentos" title="Descuentos en la cuota">
            <p>En la ficha de cada alumno, junto a su cuota, hay un check <strong>"Descuento"</strong>. Al marcarlo, la cuota de ese alumno se queda en la mitad: si paga 85 €, ese mes paga 42,50 €. Al desmarcarlo, vuelve a su cuota de siempre, aunque en el grupo haya alumnos que pagan otra cantidad.</p>
            <Aviso>El descuento es puntual, no permanente: en cuanto se registra el cobro de ese mes (efectivo o tarjeta), el check se desmarca solo y el mes siguiente vuelve a su cuota de siempre. Si el alumno debe seguir con descuento, hay que volver a marcarlo cada mes.</Aviso>
          </Section>

          <Section id="materia" title="Materia didáctica">
            <p>Sube PDFs y ejercicios, y asígnalos a uno o varios niveles. Los alumnos y monitores los ven filtrados automáticamente según el nivel correspondiente.</p>
          </Section>

          <Section id="chat" title="Chat de soporte">
            <p>Todas las conversaciones de alumnos y monitores con el club llegan aquí. Responde directamente y se avisa por push a la otra persona.</p>
          </Section>

          <Section id="notificaciones" title="Notificaciones">
            <p>Envía avisos manuales a alumnos, monitores, o ambos — a todo el club o filtrando por nivel. Útil para comunicados generales, cambios de horario puntuales, etc.</p>
          </Section>

          <Section id="configuracion" title="Configuración">
            <p>Aquí se controla todo lo que cambia el comportamiento de la app para tu club:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Información general y pistas</strong>: nombre del club, pistas disponibles.</li>
              <li><strong>Módulos activos</strong>: enciende o apaga funcionalidades (pagos, bolsa, huecos, chat, materia, objetivos, torneos, intensivos, Pista Viva, validación de clases, condiciones de uso).</li>
              <li><strong>Condiciones de uso</strong>: sube el PDF que el alumno debe aceptar en su primer acceso.</li>
              <li><strong>TPV Redsys</strong>: credenciales de cobro con tarjeta del club.</li>
              <li><strong>Tarifas</strong>: precios de clase suelta, clase entera y bonos.</li>
              <li><strong>Política de cancelación y clases de recuperación</strong>: plazos y límites.</li>
              <li><strong>Días festivos</strong>: fechas en las que no hay clase, para que no se generen sesiones ni horas ese día.</li>
              <li><strong>Inicio de facturación</strong>: fecha a partir de la cual se activan los pagos en la app cada temporada. Un cobro que caiga en los últimos días del mes cubre directamente el mes siguiente completo, así que puedes ponerla el mismo día real de inicio de temporada sin generar cobros duplicados.</li>
              <li><strong>Pista Viva — Playtomic</strong>: credenciales de la API oficial del club en Playtomic, necesarias para ese módulo.</li>
              <li><strong>Importar jugadores desde Playtomic</strong>: herramienta aparte para dar de alta jugadores en bloque (no relacionada con Pista Viva).</li>
            </ul>
          </Section>

          <Section id="faq" title="Preguntas frecuentes">
            <div className="space-y-4">
              <FAQ q="¿Por qué no veo 'Validación de clases' o 'Pista Viva' en mi menú?" a="Son módulos opcionales. Actívalos desde Configuración → Módulos activos si tu club los va a usar." />
              <FAQ q="Cambié el rol de un alumno a monitor y sigue apareciendo en su antigua clase" a="Cambiar el rol no quita al usuario de sus inscripciones — son cosas independientes. Si de verdad sigue jugando esa clase, márcalo como 'También es alumno' en su ficha; si ya no debería estar, quítalo manualmente desde la ficha de la clase." />
              <FAQ q="¿Cómo pongo un sustituto para un monitor un día concreto?" a="Entra en la clase afectada y pulsa 'Poner un sustituto solo el [fecha]', junto al cambio de hora puntual. No cambia el monitor habitual para el resto de la temporada." />
              <FAQ q="Las horas de un monitor no cuadran" a="Si el club no usa Validación de clases, las horas se calculan solas a partir del horario fijo — revisa si hay clases de prueba activas asignadas a ese monitor, o si falta registrar un sustituto en algún día." />
              <FAQ q="¿Puedo tener varios clubes gestionados desde la misma cuenta?" a="Solo las cuentas de tipo Super Admin pueden gestionar varios clubes, desde la sección Clubes." />
            </div>
          </Section>

        </div>

        <aside className="hidden lg:block">
          <nav aria-label="Contenido de la ayuda" className="sticky top-6 rounded-card border border-line bg-surface p-3 shadow-card">
            <p className="mb-2 px-3 text-label text-ink-2">Contenido</p>
            <ul className="space-y-0.5">
              {NAV_ITEMS.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="block rounded-control px-3 py-1.5 text-label text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

      </div>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-4 p-4 sm:p-5">
      <h2 className="mb-3 text-heading text-ink">{title}</h2>
      <div className="text-body text-ink-2">{children}</div>
    </Card>
  )
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-2 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-meta font-medium tabular-nums text-accent-ink">{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <Notice tone="warn" icon={<TriangleAlert />} className="mt-3">
      <strong>Importante: </strong>{children}
    </Notice>
  )
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <Notice tone="neutral" icon={<Info />} className="mt-3">
      {children}
    </Notice>
  )
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <p className="text-label text-ink">{q}</p>
      <p className="mt-1 text-ink-2">{a}</p>
    </div>
  )
}
