import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Notice } from '@/components/ui/feedback'
import { buttonVariants } from '@/components/ui/button'

const NAV_ITEMS = [
  { id: 'que-es',          label: '¿Qué es?' },
  { id: 'menu',            label: 'El menú' },
  { id: 'mis-clases',      label: 'Mis clases' },
  { id: 'detalle-clase',   label: 'Detalle de una clase' },
  { id: 'validacion',      label: 'Validación de clases' },
  { id: 'calendario',      label: 'Calendario maestro' },
  { id: 'tambien-alumno',  label: 'Perfil de alumno' },
  { id: 'material',        label: 'Materia' },
  { id: 'chat',            label: 'Chat soporte' },
  { id: 'faq',             label: 'Preguntas frecuentes' },
]

export default function CoachAyudaPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="Ayuda" description="Todo lo que necesitas saber para usar el panel de monitor" />

      <div className="lg:grid lg:grid-cols-[1fr_164px] lg:gap-8 lg:items-start">

        <div className="space-y-6">
          <Section id="que-es" title="¿Qué es esta aplicación?">
            <p>Es el panel del club desde el que gestionas tus clases: quién está apuntado, quién falta, qué materia tienen asignada según su nivel, y el calendario completo de pistas del club.</p>
            <p className="mt-2">Funciona desde cualquier navegador y dispositivo — móvil, tablet u ordenador. No hace falta instalar nada.</p>
          </Section>

          <Section id="menu" title="El menú principal">
            <div className="mt-2 divide-y divide-line overflow-hidden rounded-control border border-line">
              {[
                ['Inicio', 'Resumen de tu día y accesos rápidos.'],
                ['Mis Clases', 'Tus clases asignadas, en vista lista o calendario semanal.'],
                ['Calendario maestro', 'Todas las pistas y monitores del club, no solo las tuyas.'],
                ['Materia', 'PDFs y ejercicios por nivel, para consultar o compartir con tus alumnos.'],
                ['Tarifas/Normas/Cal.', 'Precios, normas del club y calendario de festivos, para consulta.'],
                ['Chat soporte', 'Contacto directo con el club.'],
                ['Ayuda', 'Este manual.'],
              ].map(([label, desc]) => (
                <div key={label} className="flex flex-col gap-0.5 bg-surface px-4 py-3 sm:flex-row sm:gap-3">
                  <span className="shrink-0 text-label text-ink sm:w-40">{label}</span>
                  <span className="text-body text-ink-2">{desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-meta text-ink-3">Si alguna opción no aparece en tu menú, es que el club no la usa.</p>
          </Section>

          <Section id="mis-clases" title="Mis clases">
            <p>Muestra todas las clases fijas que tienes asignadas. Tiene dos vistas, arriba a la derecha:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Calendario</strong> (la que se abre por defecto): tus clases organizadas por día de la semana, de un vistazo.</li>
              <li><strong>Lista</strong>: el mismo contenido en formato de lista, agrupado por día.</li>
            </ul>
            <p className="mt-2">Pulsa sobre cualquier clase para entrar al detalle.</p>
          </Section>

          <Section id="detalle-clase" title="Detalle de una clase">
            <p>Al entrar en una clase concreta ves:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Grupo fijo</strong>: los alumnos inscritos de forma permanente, con su nivel y un acceso directo a sus <strong>Objetivos</strong>.</li>
              <li><strong>Materia didáctica</strong>: los PDFs publicados para el nivel de esa clase, si el club usa este módulo.</li>
              <li><strong>Lista de asistencia</strong>: alumnos que han reservado esa clase de forma puntual (bolsa o hueco libre) — márcalos como asistente o ausente según asistan.</li>
            </ul>
            <Nota>Los cambios de hora puntuales y los sustitutos de monitor para un día concreto los gestiona el club desde su panel de admin — si tu clase cambia de hora o la va a dar otro monitor un día, te llegará un aviso.</Nota>
          </Section>

          <Section id="validacion" title="Validación de clases">
            <p>Si tu club usa este módulo, verás un bloque extra arriba del todo <strong>solo el mismo día que toca la clase</strong>, para marcar si se ha dado o no.</p>
            <Steps items={[
              'Entra en la clase el mismo día, a la hora que toca (o después).',
              'Marca si la clase se ha dado o no, y por qué si no se ha dado.',
              'Si hay algún alumno ausente ese día, márcalo también.',
            ]} />
            <Aviso>Una clase marcada por ti no cuenta como confirmada hasta que el club la valida desde su panel — es un doble control para que las horas y los pagos sean exactos.</Aviso>
          </Section>

          <Section id="calendario" title="Calendario maestro">
            <p>Muestra la semana completa del club: todas las pistas, todos los monitores y los alumnos de cada grupo fijo — no solo tus propias clases. Útil para ver quién más da clase a la misma hora, en qué pista está libre un hueco, etc.</p>
            <p className="mt-2 text-body text-ink-3">Es solo de consulta: no puedes editar clases de otros monitores desde aquí.</p>
          </Section>

          <Section id="tambien-alumno" title="Si también eres alumno del club">
            <p>Si el club te ha marcado como monitor y alumno a la vez, verás un aviso <strong>"Ver como alumno"</strong> en el menú lateral. Al pulsarlo, entras al panel de alumno con tu misma cuenta — ahí puedes ver tu propia clase, tu cuota y todo lo que ve un alumno normal.</p>
            <p className="mt-2">Para volver, usa el enlace <strong>"Volver a Monitor"</strong> que aparece en el panel de alumno.</p>
          </Section>

          <Section id="material" title="Materia didáctica">
            <p>Consulta los PDFs y ejercicios publicados por el club, filtrados por nivel. Puedes verlos también desde dentro de cada clase, ya filtrados al nivel de esa clase concreta.</p>
          </Section>

          <Section id="chat" title="Chat de soporte">
            <p>¿Dudas sobre la aplicación o sobre tus clases? Escribe directamente al club desde <strong>Chat soporte</strong>. Te avisamos cuando respondan.</p>
          </Section>

          <Section id="faq" title="Preguntas frecuentes">
            <div className="space-y-4">
              <FAQ q="No veo el botón para marcar la clase como dada" a="Solo aparece el mismo día que toca la clase, y solo si tu club tiene activado el módulo de validación de clases. Si tu club no lo usa, no verás ese bloque nunca." />
              <FAQ q="Un día no puedo dar mi clase, ¿qué hago?" a="Avisa al club — ellos pueden asignar un sustituto solo para ese día desde su panel, sin tocar tu horario habitual. Ese día contará para el sustituto, no para ti." />
              <FAQ q="¿Por qué veo clases de otros monitores en el Calendario maestro?" a="Es la vista completa del club, para que sepas qué hay en cada pista a cada hora. Solo puedes editar las tuyas, desde Mis Clases." />
              <FAQ q="No me deja entrar al panel de alumno" a="Solo se puede si el club te ha marcado explícitamente como 'también alumno' en tu ficha. Si crees que deberías tener acceso, contacta con el club." />
              <FAQ q="¿Puedo usar la aplicación desde el móvil?" a="Sí, funciona en cualquier navegador y dispositivo sin instalar nada." />
            </div>
          </Section>

          <Card className="p-5 text-center">
            <p className="text-heading text-ink">¿No encuentras lo que buscas?</p>
            <p className="mb-4 mt-1 text-body text-ink-2">Escríbenos directamente y te respondemos lo antes posible.</p>
            <Link href="/coach/chat" className={buttonVariants()}>
              Abrir chat de soporte
            </Link>
          </Card>
        </div>

        <aside className="hidden lg:block">
          <Card className="sticky top-6 p-4">
            <p className="mb-3 text-label text-ink-2">Contenido</p>
            <nav aria-label="Contenido de la ayuda" className="space-y-0.5">
              {NAV_ITEMS.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block rounded-control px-3 py-1.5 text-body text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  {label}
                </a>
              ))}
            </nav>
          </Card>
        </aside>

      </div>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-4 p-5 sm:p-6">
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
    <Notice tone="warn" className="mt-3">
      <strong>Importante: </strong>{children}
    </Notice>
  )
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <Notice tone="success" className="mt-3">
      {children}
    </Notice>
  )
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <p className="text-label text-ink">{q}</p>
      <p className="mt-1 text-body text-ink-2">{a}</p>
    </div>
  )
}
