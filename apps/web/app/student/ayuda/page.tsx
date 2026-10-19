import Link from 'next/link'
import { Info, TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/feedback'
import { buttonVariants } from '@/components/ui/button'
import { PushStatusCard } from '@/components/push-status-card'
import { getClubId } from '@/lib/get-club'
import { getClubFeatures } from '@/lib/get-club-features'
import { getAdminClient } from '@/lib/supabase/admin'

// La ayuda solo explica lo que el club tiene activado: así nadie busca un
// botón que en su club no existe.
export default async function AyudaPage() {
  const clubId = await getClubId()
  const features = await getClubFeatures(clubId)
  const { data: club } = clubId
    ? await getAdminClient().from('clubs').select('config').eq('id', clubId).single()
    : { data: null }
  const cancelHours: number = (club as any)?.config?.cancellation_hours ?? 24
  const payments = features.enable_payments && !features.cash_only_payments
  const autoPay = payments && features.enable_auto_pay
  const waitlist = features.enable_waitlist && features.enable_spots

  const NAV_ITEMS = [
    { id: 'instalar', label: 'Instalar la app' },
    { id: 'avisos', label: 'Avisos en el móvil' },
    { id: 'menu', label: 'El menú' },
    { id: 'no-puedo-ir', label: 'No puedo ir' },
    features.enable_spots && { id: 'huecos', label: 'Huecos libres' },
    waitlist && { id: 'reservas', label: 'Reservas en espera' },
    features.enable_bag && { id: 'bolsa', label: 'Bolsa de clases' },
    features.enable_payments && { id: 'pagos', label: 'Pagos' },
    { id: 'campanita', label: 'Notificaciones' },
    features.enable_pista_viva && { id: 'pista-viva', label: 'Pista Viva' },
    features.enable_materials && { id: 'material', label: 'Material' },
    features.enable_chat && { id: 'chat', label: 'Hablar con el club' },
    { id: 'privacidad', label: 'Privacidad' },
    { id: 'faq', label: 'Preguntas frecuentes' },
  ].filter(Boolean) as { id: string; label: string }[]

  const menu: [string, string][] = [
    ['Inicio', 'Tu próxima clase, si tienes la cuota al día y accesos rápidos.'],
    ['Mis clases', 'Tus grupos, tus cuotas y los días que no puedes ir.'],
    ...(features.enable_spots ? [['Huecos', waitlist ? 'Plazas libres de tu nivel y clases en las que puedes ponerte en reserva.' : 'Plazas libres de tu nivel para recuperar una clase o jugar más.'] as [string, string]] : []),
    ...(features.enable_bag ? [['Bolsa', 'Las clases que tienes para recuperar o jugar más.'] as [string, string]] : []),
    ...(features.enable_objectives ? [['Mi progreso', 'Tu nivel y tus objetivos.'] as [string, string]] : []),
    ...(features.enable_intensivos ? [['Intensivos', 'Cursos intensivos del club.'] as [string, string]] : []),
    ...(features.enable_tournaments ? [['Torneos', 'Torneos del club e inscripción.'] as [string, string]] : []),
    ...(features.enable_materials ? [['Material', 'PDFs y vídeos para tu nivel.'] as [string, string]] : []),
    ['Tarifas y normas', 'Precios y normas del club.'],
    ...(features.enable_chat ? [['Hablar con el club', 'Escribe al club y te responden aquí.'] as [string, string]] : []),
    ['Notificaciones', 'Todos los avisos que te ha enviado el club.'],
    ['Mis datos', 'Tus datos y tu contraseña.'],
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="Ayuda" description="Todo lo que necesitas para usar la app de la escuela." />
      <nav aria-label="Temas de la ayuda" className="lg:hidden">
        <p className="mb-2 text-label text-ink-2">Salta a un tema</p>
        <ul className="flex flex-wrap gap-2">
          {NAV_ITEMS.map(({ id, label }) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-3 text-label text-ink-2 hover:bg-surface-2 hover:text-ink">{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="lg:grid lg:grid-cols-[1fr_200px] lg:items-start lg:gap-8">
        <div className="space-y-8">
          <Section id="instalar" title="Instala la app en tu móvil">
            <p>No hace falta descargar nada de la tienda: la app se añade a la pantalla de inicio en un minuto y se abre como cualquier otra.</p>
            <p className="mt-3 text-label text-ink">iPhone</p>
            <Steps items={[
              'Abre epadelschool.app en Safari (tiene que ser Safari).',
              'Pulsa el botón Compartir: el cuadrado con la flecha hacia arriba, abajo en la pantalla.',
              'Elige "Añadir a pantalla de inicio" y pulsa Añadir.',
              'A partir de ahora, abre siempre la app desde ese icono.',
            ]} />
            <p className="mt-4 text-label text-ink">Android</p>
            <Steps items={[
              'Abre epadelschool.app en Chrome.',
              'Pulsa el menú ⋮ (arriba a la derecha).',
              'Elige "Instalar aplicación" o "Añadir a pantalla de inicio".',
            ]} />
            <Nota>Entras con el mismo email y contraseña de siempre. Si no la recuerdas, pulsa "¿Olvidaste tu contraseña?" en la pantalla de entrada y te llegará un email (mira también en spam).</Nota>
          </Section>

          <Section id="avisos" title="Avisos en el móvil">
            <p>Con los avisos activados te llega al momento al móvil:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {features.enable_spots && <li>🎾 cuando se libera un hueco de tu nivel;</li>}
              {waitlist && <li>🎾 cuando entras en una clase desde la reserva;</li>}
              {features.enable_chat && <li>💬 cuando el club te escribe por el chat;</li>}
              <li>💳 y ⏰ los recordatorios de cuota, de clases en la bolsa y de clase al día siguiente.</li>
            </ul>
            <p className="mt-3">Aquí puedes ver cómo están en este móvil, activarlos o mandarte un aviso de prueba:</p>
            <PushStatusCard className="mt-3" />
            <Aviso>En iPhone los avisos solo funcionan si abres la app desde el icono de la pantalla de inicio (mira "Instala la app"). Si un día dejan de llegarte, entra aquí y pulsa "Enviarme un aviso de prueba".</Aviso>
          </Section>

          <Section id="menu" title="El menú">
            <p>Abajo tienes las pestañas principales; el resto está en <strong>Más</strong>.</p>
            <Card className="mt-3 divide-y divide-line overflow-hidden">
              {menu.map(([label, desc]) => (
                <div key={label} className="flex flex-wrap gap-x-3 gap-y-0.5 px-4 py-3">
                  <span className="w-36 shrink-0 text-label text-ink">{label}</span>
                  <span className="min-w-0 flex-1 text-body text-ink-2">{desc}</span>
                </div>
              ))}
            </Card>
          </Section>

          <Section id="no-puedo-ir" title="Si no puedes ir a tu clase">
            <Steps items={[
              'Ve a Mis clases y elige el día en el calendario.',
              'Pulsa "No puedo ir este día" y confirma.',
              ...(features.enable_bag ? ['Se te suma 1 clase a la bolsa para recuperarla otro día, y tu plaza queda libre para otro alumno.'] : ['Tu plaza queda libre para otro alumno.']),
            ]} />
            <Aviso>Tienes que avisar con al menos {cancelHours} horas de antelación. Si cambias de idea, pulsa "Al final sí voy": puedes recuperar tu plaza mientras nadie la haya cogido.</Aviso>
          </Section>

          {features.enable_spots && (
            <Section id="huecos" title="Huecos libres: recuperar o jugar más">
              <Steps items={[
                'Ve a Huecos. Los días marcados con un punto tienen plazas libres de tu nivel.',
                'Elige el día y la clase que te venga bien.',
                features.enable_bag ? 'Pulsa "Apuntarme con 1 clase de la bolsa".' : 'Pulsa el botón para apuntarte.',
              ]} />
              {payments && <p className="mt-2">Si no tienes clases en la bolsa, puedes pagar la plaza suelta con tarjeta desde el mismo sitio.</p>}
            </Section>
          )}

          {waitlist && (
            <Section id="reservas" title="Reservas en espera">
              <p>Si una clase está completa pero alguien ha cogido en ella una plaza suelta, puedes ponerte <strong>en reserva</strong>. Como mucho hay 2 personas en reserva por clase y día.</p>
              <Steps items={[
                'En Huecos, elige el día: debajo verás "Clases completas".',
                'Pulsa "Apuntarme en reserva" y confirma. Verás si eres el 1º o el 2º.',
                `Si alguien deja su plaza con más de ${cancelHours} horas de antelación, entras tú solo: se te descuenta 1 clase de la bolsa y te llega un aviso al móvil.`,
              ]} />
              <Nota>Para ponerte en reserva necesitas al menos 1 clase en la bolsa. Si la plaza se libera con menos de {cancelHours} horas, no te metemos sin preguntar: te avisamos para que la cojas tú si puedes ir. Puedes quitarte cuando quieras desde "Tus reservas", arriba en Huecos.</Nota>
            </Section>
          )}

          {features.enable_bag && (
            <Section id="bolsa" title="La bolsa de clases">
              <p>La bolsa guarda las clases que tienes para recuperar o jugar más. Se te suma una cuando avisas a tiempo de que no vas, y se gasta cuando te apuntas a un hueco{waitlist ? ' o entras desde una reserva' : ''}.</p>
              {payments && <p className="mt-2">También puedes recargarla comprando un bono en <strong>Bolsa</strong>.</p>}
            </Section>
          )}

          {features.enable_payments && (
            <Section id="pagos" title="Pagos">
              {payments ? (
                <>
                  <p>Pagas con tarjeta en la página segura del banco (Redsys). La app nunca guarda los datos de tu tarjeta.</p>
                  <Steps items={[
                    'Ve a Mis clases: arriba verás si tienes alguna cuota pendiente.',
                    'Si vas a varios grupos, pulsa "Pagar todo" y pagas todas las cuotas juntas en un solo pago.',
                    'Al terminar, tus grupos quedan marcados como pagados.',
                  ]} />
                  <p className="mt-2">Si ya estás al día, puedes adelantar la cuota del mes siguiente con el botón "Adelantar".</p>
                  {autoPay && (
                    <Nota><strong>Pago automático con tarjeta:</strong> en Mis clases puedes guardar tu tarjeta para que tus cuotas se cobren solas cada mes. Lo que ya hayas pagado no se vuelve a cobrar, y puedes cancelarlo cuando quieras.</Nota>
                  )}
                </>
              ) : (
                <p>En tu club las cuotas se pagan en el propio club. En Mis clases verás si tienes alguna pendiente.</p>
              )}
            </Section>
          )}

          <Section id="campanita" title="Notificaciones (la campanita)">
            <p>La campanita de arriba guarda todos los avisos del club. Un punto rojo indica que tienes avisos sin leer.</p>
            <p className="mt-2">Si tocas un aviso en el móvil, queda leído y la campanita se actualiza sola. Al entrar en <strong>Notificaciones</strong> se marcan todos como leídos.</p>
          </Section>

          {features.enable_pista_viva && (
            <Section id="pista-viva" title="Pista Viva">
              <p>Pista Viva te avisa cuando en el club hay un partido abierto en Playtomic al que le faltan jugadores de tu nivel.</p>
              <Steps items={[
                'Ve a Inicio y busca la tarjeta Pista Viva.',
                'En la app de Playtomic, entra en tu perfil y pulsa Compartir perfil → Copiar enlace.',
                'Pega ese enlace en la tarjeta y pulsa Activar avisos.',
              ]} />
              <Nota>Playtomic solo hace visible un partido abierto cuando ya tiene al menos 2 jugadores. Si ves uno con 1 solo jugador, aparecerá aquí en cuanto se apunte el segundo.</Nota>
            </Section>
          )}

          {features.enable_materials && (
            <Section id="material" title="Material">
              <p>En <strong>Material</strong> tienes los PDFs y vídeos que el club publica para tu nivel. Al subir de nivel verás contenido nuevo.</p>
            </Section>
          )}

          {features.enable_chat && (
            <Section id="chat" title="Hablar con el club">
              <p>Escribe al club desde <strong>Hablar con el club</strong>. Cuando te respondan te llegará un aviso al móvil.</p>
            </Section>
          )}

          <Section id="privacidad" title="Privacidad y tus datos">
            <p>El club usa tus datos (nombre, email, clases y pagos) solo para gestionar tu inscripción. No se ceden a nadie, salvo al banco para procesar los pagos.</p>
            <p className="mt-2">Puedes consultar la política completa y pedir la baja desde <strong>Más → Privacidad y datos</strong>.</p>
          </Section>

          <Section id="faq" title="Preguntas frecuentes">
            <div className="space-y-4">
              <FAQ q="No me llegan los avisos al móvil" a={'Ve a "Avisos en el móvil" en esta ayuda (o en Más) y mira qué te dice. En iPhone tienes que abrir la app desde el icono de la pantalla de inicio. Si dice "Activados", pulsa "Enviarme un aviso de prueba": si no te llega, pulsa "Volver a activar".'} />
              <FAQ q="¿Con cuánta antelación tengo que avisar si no puedo ir?" a={`Con al menos ${cancelHours} horas. Así se te suma la clase a la bolsa y tu plaza queda libre para otro alumno.`} />
              {waitlist && <FAQ q="¿Qué pasa si estoy en reserva y se libera la plaza?" a={`Si falta más de ${cancelHours} horas para la clase, entras tú solo, se te descuenta 1 clase de la bolsa y te avisamos. Si falta menos, solo te avisamos para que la cojas en Huecos si puedes ir.`} />}
              {payments && <FAQ q="Voy a dos grupos, ¿tengo que pagar dos veces?" a={'No. En Mis clases pulsa "Pagar todo" y pagas las cuotas de todos tus grupos en un solo pago.'} />}
              <FAQ q="No recuerdo mi contraseña" a={'Pulsa "¿Olvidaste tu contraseña?" en la pantalla de entrada. Te llegará un email para cambiarla (mira también en spam).'} />
              <FAQ q="¿Puedo cambiarme de grupo?" a="Los cambios de grupo los hace el club. Escríbeles y te lo cambian: lo que tengas pagado pasa al grupo nuevo." />
              {payments && <FAQ q="He pagado y sigue saliendo pendiente" a="El pago se marca en cuanto el banco lo confirma, normalmente al momento. Si tras unos minutos sigue pendiente, escribe al club." />}
            </div>
          </Section>

          {features.enable_chat && (
            <Card className="p-5 text-center">
              <p className="text-heading text-ink">¿No encuentras lo que buscas?</p>
              <p className="mb-4 mt-1 text-body text-ink-2">Escríbenos y te respondemos lo antes posible.</p>
              <Link href="/student/chat" className={buttonVariants({ variant: 'primary' })}>Hablar con el club</Link>
            </Card>
          )}
        </div>

        <aside className="hidden lg:block">
          <Card className="sticky top-6 p-4">
            <p className="mb-2 text-label text-ink-2">Contenido</p>
            <nav aria-label="Contenido de la ayuda" className="space-y-0.5">
              {NAV_ITEMS.map(({ id, label }) => (
                <a key={id} href={`#${id}`} className="block rounded-control px-3 py-2 text-body text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink">{label}</a>
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
