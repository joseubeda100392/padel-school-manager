import Link from 'next/link'
import { Info, TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/feedback'
import { buttonVariants } from '@/components/ui/button'

const NAV_ITEMS = [
  { id: 'que-es',         label: '¿Qué es?' },
  { id: 'acceso',         label: 'Cómo acceder' },
  { id: 'menu',           label: 'El menú' },
  { id: 'clases',         label: 'Mis clases' },
  { id: 'recuperar',      label: 'Recuperar clase' },
  { id: 'pista-viva',     label: 'Pista Viva' },
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
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="Ayuda" description="Todo lo que necesitas saber para usar la aplicación." />

      <div className="lg:grid lg:grid-cols-[1fr_200px] lg:items-start lg:gap-8">

        {/* Contenido principal */}
        <div className="space-y-8">
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
            <Card className="mt-2 divide-y divide-line overflow-hidden">
              {[
                ['Mi perfil', 'Tus datos personales, resumen de clases y bolsa, próxima clase, Pista Viva y cambio de contraseña.'],
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
                <div key={label} className="flex flex-wrap gap-x-3 gap-y-0.5 px-4 py-3">
                  <span className="w-32 shrink-0 text-label text-ink">{label}</span>
                  <span className="min-w-0 flex-1 text-body text-ink-2">{desc}</span>
                </div>
              ))}
            </Card>
            <p className="mt-3 text-meta text-ink-3">Si alguna opción no aparece en tu menú, es que el club no la usa.</p>
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
            <p className="mt-2 text-ink-3">Las plazas de recuperación son limitadas y dependen de la disponibilidad del club.</p>
          </Section>

          <Section id="pista-viva" title="Pista Viva">
            <p>Pista Viva te avisa cuando en el club hay un partido abierto en Playtomic al que le faltan jugadores de tu nivel, para que puedas apuntarte y jugar con otros socios del club.</p>
            <p className="mt-3 text-label text-ink">Cómo activarlo</p>
            <Steps items={[
              'Ve a Mi perfil y busca la tarjeta Pista Viva.',
              'En la app de Playtomic, entra en tu perfil y pulsa Compartir perfil → Copiar enlace.',
              'Pega ese enlace en la tarjeta de Pista Viva y pulsa Activar avisos. Tu nivel real de Playtomic se guarda automáticamente.',
            ]} />
            <p className="mt-3">Una vez activado, verás ahí mismo los partidos abiertos de tu nivel disponibles ahora mismo en el club, con un enlace directo para apuntarte en Playtomic. También puedes elegir en qué días y franjas horarias te interesa recibir avisos, y desactivarlo cuando quieras con el botón <strong>Desactivar</strong>.</p>
            <Nota>Playtomic solo hace visible un partido abierto cuando ya tiene al menos 2 jugadores apuntados. Si ves un partido con 1 solo jugador, es normal que todavía no aparezca aquí — se mostrará en cuanto se apunte un segundo jugador.</Nota>
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
            <p className="mt-3 text-label text-ink">Cómo activarlas</p>
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
              <FAQ q="Veo un partido en Playtomic pero no me sale en Pista Viva, ¿por qué?" a="Playtomic solo hace visible un partido abierto cuando ya tiene al menos 2 jugadores apuntados. Si el partido todavía tiene solo 1 jugador, aparecerá en Pista Viva en cuanto se apunte el segundo." />
            </div>
          </Section>

          <Card className="p-5 text-center">
            <p className="text-heading text-ink">¿No encuentras lo que buscas?</p>
            <p className="mb-4 mt-1 text-body text-ink-2">Escríbenos directamente y te respondemos lo antes posible.</p>
            <Link href="/student/chat" className={buttonVariants({ variant: 'primary' })}>
              Abrir chat de soporte
            </Link>
          </Card>
        </div>

        {/* Índice lateral: solo ordenador */}
        <aside className="hidden lg:block">
          <Card className="sticky top-6 p-4">
            <p className="mb-2 text-label text-ink-2">Contenido</p>
            <nav aria-label="Contenido de la ayuda" className="space-y-0.5">
              {NAV_ITEMS.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block rounded-control px-3 py-2 text-body text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink"
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
    <section id={id} className="scroll-mt-20 space-y-3">
      <SectionTitle>{title}</SectionTitle>
      <div className="text-body text-ink-2">{children}</div>
    </section>
  )
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-2 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-meta font-semibold tabular-nums text-accent-ink">{i + 1}</span>
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
      <p className="mt-1 text-body text-ink-2">{a}</p>
    </div>
  )
}
