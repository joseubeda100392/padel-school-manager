import Link from 'next/link'

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
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ayuda</h1>
        <p className="text-sm text-gray-500">Todo lo que necesitas saber para usar el panel de monitor</p>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_164px] lg:gap-8 lg:items-start">

        <div className="space-y-6">
          <Section id="que-es" title="¿Qué es esta aplicación?">
            <p>Es el panel del club desde el que gestionas tus clases: quién está apuntado, quién falta, qué materia tienen asignada según su nivel, y el calendario completo de pistas del club.</p>
            <p className="mt-2">Funciona desde cualquier navegador y dispositivo — móvil, tablet u ordenador. No hace falta instalar nada.</p>
          </Section>

          <Section id="menu" title="El menú principal">
            <div className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
              {[
                ['Inicio', 'Resumen de tu día y accesos rápidos.'],
                ['Mis Clases', 'Tus clases asignadas, en vista lista o calendario semanal.'],
                ['Calendario maestro', 'Todas las pistas y monitores del club, no solo las tuyas.'],
                ['Materia', 'PDFs y ejercicios por nivel, para consultar o compartir con tus alumnos.'],
                ['Tarifas/Normas/Cal.', 'Precios, normas del club y calendario de festivos, para consulta.'],
                ['Chat soporte', 'Contacto directo con el club.'],
                ['Ayuda', 'Este manual.'],
              ].map(([label, desc]) => (
                <div key={label} className="flex gap-3 bg-white px-4 py-3">
                  <span className="w-40 shrink-0 text-sm font-semibold text-gray-800">{label}</span>
                  <span className="text-sm text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">Si alguna opción no aparece en tu menú, es que el club no la usa.</p>
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
              <li><strong>Lista de asistencia</strong>: alumnos que han reservado esa clase de forma puntual (bolsa o hueco libre) — márcalos con ✓ o ✗ según asistan.</li>
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
            <p className="mt-2 text-sm text-gray-500">Es solo de consulta: no puedes editar clases de otros monitores desde aquí.</p>
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

          <div className="rounded-xl bg-brand-50 border border-brand-100 p-5 text-center">
            <p className="text-sm font-semibold text-brand-700 mb-1">¿No encuentras lo que buscas?</p>
            <p className="text-sm text-brand-600 mb-3">Escríbenos directamente y te respondemos lo antes posible.</p>
            <Link href="/coach/chat" className="inline-block rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600">
              Abrir chat de soporte
            </Link>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Contenido</p>
            <nav className="space-y-0.5">
              {NAV_ITEMS.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

      </div>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-4 rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-base font-semibold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
    </div>
  )
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-2 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <strong>Importante: </strong>{children}
    </div>
  )
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
      {children}
    </div>
  )
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <p className="font-semibold text-gray-800">{q}</p>
      <p className="mt-1 text-gray-500">{a}</p>
    </div>
  )
}
