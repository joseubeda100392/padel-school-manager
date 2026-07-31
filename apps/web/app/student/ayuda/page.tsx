const NAV_ITEMS = [
  { id: 'que-es',         label: '¿Qué es?' },
  { id: 'acceso',         label: 'Cómo acceder' },
  { id: 'menu',           label: 'El menú' },
  { id: 'clases',         label: 'Mis clases' },
  { id: 'recuperar',      label: 'Recuperar clase' },
  { id: 'bolsa',          label: 'Bolsa de clases' },
  { id: 'material',       label: 'Materia' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'pagos',          label: 'Pagos' },
  { id: 'chat',           label: 'Chat soporte' },
  { id: 'privacidad',     label: 'Privacidad' },
  { id: 'faq',            label: 'Preguntas frecuentes' },
]

export default function AyudaPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ayuda</h1>
        <p className="text-sm text-gray-500">Todo lo que necesitas saber para usar la aplicación</p>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_164px] lg:gap-8 lg:items-start">

        {/* Contenido principal */}
        <div className="space-y-6">
          <Section id="que-es" title="¿Qué es esta aplicación?">
            <p>Esta es la plataforma digital de tu escuela de pádel. Desde ella puedes consultar tus clases, gestionar tu bolsa de créditos, recuperar clases perdidas, pagar bonos y contactar con el club.</p>
            <p className="mt-2">Funciona desde cualquier navegador y en cualquier dispositivo: móvil, tablet u ordenador. Solo necesitas el enlace que te ha dado el club.</p>
          </Section>

          <Section id="acceso" title="Cómo acceder">
            <Steps items={[
              'Abre el enlace que te ha enviado el club.',
              'Introduce tu email y la contraseña que te han proporcionado.',
              'La primera vez tendrás que elegir una contraseña personal.',
              'Lee y acepta las condiciones de uso del club.',
            ]} />
            <Aviso>Si olvidaste tu contraseña, pulsa "¿Olvidaste tu contraseña?" en la pantalla de inicio. Recibirás un email para restablecerla. Revisa también la carpeta de spam.</Aviso>
          </Section>

          <Section id="menu" title="El menú principal">
            <div className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
              {[
                ['Mi perfil', 'Tus datos personales, resumen de clases y bolsa, próxima clase y cambio de contraseña.'],
                ['Mis Clases', 'Tus clases apuntadas, horarios y asistencia.'],
                ['Mi Progreso', 'Tu nivel actual e historial de progresión.'],
                ['Huecos', 'Plazas libres en otras clases para recuperar una que hayas perdido.'],
                ['Intensivos', 'Cursos intensivos del club.'],
                ['Torneos', 'Torneos disponibles e inscripción.'],
                ['Bolsa', 'Saldo de créditos de clases y recargas.'],
                ['Materia', 'PDFs y ejercicios adaptados a tu nivel.'],
                ['Tarifas', 'Precios del club: bonos, clases sueltas e intensivos.'],
                ['Notificaciones', 'Avisos y mensajes del club.'],
                ['Chat soporte', 'Escríbenos directamente si tienes alguna duda.'],
                ['Ayuda', 'Este manual y preguntas frecuentes.'],
              ].map(([label, desc]) => (
                <div key={label} className="flex gap-3 bg-white px-4 py-3">
                  <span className="w-32 shrink-0 text-sm font-semibold text-gray-800">{label}</span>
                  <span className="text-sm text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">Si alguna opción no aparece en tu menú, es que el club no la usa.</p>
          </Section>

          <Section id="clases" title="Cancelar una clase">
            <Steps items={[
              'Ve a Mis Clases.',
              'Pulsa sobre la clase que no puedes asistir.',
              'Pulsa Cancelar asistencia y confirma.',
            ]} />
            <Aviso>El club tiene un plazo mínimo de cancelación. Si avisas dentro de ese plazo, el crédito vuelve automáticamente a tu bolsa. Si avisas tarde o no avisas, el crédito no se recupera. Pregunta a tu monitor o al club para conocer el plazo exacto.</Aviso>
          </Section>

          <Section id="recuperar" title="Recuperar una clase perdida">
            <Steps items={[
              'Ve a la sección Huecos.',
              'Busca un horario libre que te venga bien.',
              'Pulsa Reservar hueco y confirma.',
            ]} />
            <p className="mt-2 text-sm text-gray-500">Las plazas de recuperación son limitadas y dependen de la disponibilidad del club.</p>
          </Section>

          <Section id="bolsa" title="Mi bolsa de clases">
            <p>La bolsa es tu saldo de créditos. Cada clase que asistes descuenta 1 crédito. Puedes recargar comprando un bono desde la sección <strong>Bolsa</strong>.</p>
            <p className="mt-2">Si cancelas con suficiente antelación, el crédito se devuelve solo. Si tu saldo llega a 0, consulta con el club si puedes pagar una clase suelta.</p>
          </Section>

          <Section id="material" title="Materia didáctica">
            <p>El club publica PDFs y ejercicios adaptados a tu nivel. Ve a la sección <strong>Materia</strong> para verlos y descargarlos. A medida que subas de nivel tendrás acceso a nuevos contenidos.</p>
            <Nota>Si no ves materias, puede que el club aún no haya publicado contenido para tu nivel. Consúltalo con tu monitor.</Nota>
          </Section>

          <Section id="notificaciones" title="Notificaciones">
            <p>La aplicación te avisa cuando el club te envía un aviso directo o cuando hay un hueco libre disponible para recuperar una clase.</p>
            <p className="mt-3 text-sm font-semibold text-gray-800">Cómo activarlas</p>
            <p className="mt-1">La primera vez que accedas, el navegador te preguntará si quieres recibir notificaciones. Pulsa <strong>Permitir</strong> — si las bloqueas no recibirás ningún aviso del club.</p>
            <Aviso>Si las bloqueaste por error: ve a la configuración de tu navegador → Privacidad y seguridad → Notificaciones, busca la dirección de la app y cámbiala a "Permitir". En el móvil puedes hacerlo desde Ajustes → [nombre del navegador] → Notificaciones.</Aviso>
          </Section>

          <Section id="pagos" title="Pagos">
            <p>Los pagos se realizan con tarjeta bancaria de forma segura. Tus datos bancarios nunca se almacenan en la aplicación.</p>
            <Steps items={[
              'Ve a la sección Bolsa.',
              'Selecciona el bono que quieres comprar.',
              'Completa el pago con tarjeta.',
              'Los créditos se añaden automáticamente a tu bolsa.',
            ]} />
          </Section>

          <Section id="chat" title="Chat de soporte">
            <p>¿Tienes alguna duda? Escríbenos directamente desde la sección <strong>Chat soporte</strong>. Recibirás una notificación cuando el club te responda.</p>
            <Nota>El chat es para consultas sobre la aplicación, horarios o pagos. Para temas técnicos de pádel, habla directamente con tu monitor en la pista.</Nota>
          </Section>

          <Section id="privacidad" title="Privacidad y tus datos">
            <p>El club trata tus datos personales (nombre, email, historial de clases y pagos) únicamente para gestionar tu inscripción y actividad. Tus datos nunca se ceden a terceros salvo para procesar pagos a través de Redsys.</p>
            <p className="mt-2">Puedes consultar la política completa y ejercer tus derechos desde la sección <strong>Privacidad y datos</strong>, en la parte inferior del menú lateral.</p>
            <Nota><strong>Solicitar baja:</strong> Si quieres darte de baja del club y que se eliminen tus datos, escríbenos por el Chat de soporte o accede a Privacidad y datos en el menú. Lo gestionamos en un máximo de 30 días.</Nota>
          </Section>

          <Section id="faq" title="Preguntas frecuentes">
            <div className="space-y-4">
              <FAQ q="¿Con cuánta antelación tengo que avisar si no puedo ir a una clase?" a="El plazo mínimo lo establece el club. Pregunta a tu monitor o al club para conocer el plazo exacto. Si cancelas dentro del plazo, el crédito se devuelve. Si no, se pierde." />
              <FAQ q="No recuerdo mi contraseña" a='Pulsa "¿Olvidaste tu contraseña?" en la pantalla de inicio de sesión. Recibirás un email para restablecerla. Si no te llega, escríbenos por el chat de soporte.' />
              <FAQ q="No veo materiales en la app" a="Los materiales se asignan por nivel. Si no ves documentos, puede que el club aún no haya publicado contenido para tu nivel. Consúltalo con tu monitor." />
              <FAQ q="He pagado pero no veo los créditos en mi bolsa" a="Los créditos se actualizan automáticamente al completarse el pago. Si tras unos minutos no aparecen, contáctanos por el chat de soporte." />
              <FAQ q="¿Puedo usar la aplicación desde el móvil?" a="Sí. Funciona en cualquier navegador (Chrome, Safari, Firefox) y en cualquier dispositivo. Solo necesitas el enlace del club, no hay que instalar ninguna app." />
              <FAQ q="¿Puedo cambiarme a otro grupo o horario?" a="Los cambios de grupo los gestiona el club. Escríbenos por el chat de soporte y te ayudamos." />
              <FAQ q="¿Mis datos están seguros?" a="Sí. La aplicación cumple con el RGPD. Tus datos solo se usan para la gestión del club y nunca se ceden a terceros." />
            </div>
          </Section>

          <div className="rounded-xl bg-brand-50 border border-brand-100 p-5 text-center">
            <p className="text-sm font-semibold text-brand-700 mb-1">¿No encuentras lo que buscas?</p>
            <p className="text-sm text-brand-600 mb-3">Escríbenos directamente y te respondemos lo antes posible.</p>
            <a href="/student/chat" className="inline-block rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600">
              Abrir chat de soporte
            </a>
          </div>
        </div>

        {/* Nav lateral — solo desktop */}
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
