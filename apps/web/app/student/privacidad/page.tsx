import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Card, SectionTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/feedback'
import { TriangleAlert } from 'lucide-react'

const LIST_CLASS = 'list-disc space-y-1 pl-5'

export default function PrivacidadPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <PageHeader title="Privacidad y datos" description="Información sobre el tratamiento de tus datos personales." />

      <Section title="¿Quién trata tus datos?">
        <p>Tu club de pádel es el responsable del tratamiento de tus datos personales, de acuerdo con el Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica de Protección de Datos (LOPDGDD).</p>
      </Section>

      <Section title="¿Qué datos guardamos?">
        <ul className={LIST_CLASS}>
          <li>Nombre y dirección de email.</li>
          <li>Historial de clases, asistencia y nivel.</li>
          <li>Movimientos de tu bolsa de créditos y pagos realizados.</li>
          <li>Mensajes enviados a través del chat de soporte.</li>
          <li>Token de notificaciones push (si las has activado).</li>
        </ul>
      </Section>

      <Section title="¿Para qué usamos tus datos?">
        <ul className={LIST_CLASS}>
          <li>Gestionar tu inscripción y asistencia a clases.</li>
          <li>Procesar pagos y mantener el historial de tu bolsa.</li>
          <li>Enviarte notificaciones relacionadas con tus clases.</li>
          <li>Atender tus consultas a través del chat de soporte.</li>
        </ul>
        <p>Tus datos nunca se ceden a terceros salvo obligación legal o para procesar pagos (a través de Redsys, pasarela de pago de los bancos españoles).</p>
      </Section>

      <Section title="¿Cuánto tiempo conservamos tus datos?">
        <p>Tus datos se conservan mientras seas alumno del club. Si causas baja, se eliminan en un plazo máximo de 30 días, salvo obligación legal de conservación (por ejemplo, registros de pagos).</p>
      </Section>

      <Section title="Tus derechos">
        <p>Puedes ejercer en cualquier momento los derechos de acceso, rectificación, supresión, portabilidad y oposición escribiéndonos a través del chat de soporte.</p>
        <ul className={LIST_CLASS}>
          <li><strong>Acceso:</strong> saber qué datos tenemos sobre ti.</li>
          <li><strong>Rectificación:</strong> corregir datos incorrectos.</li>
          <li><strong>Supresión:</strong> solicitar que eliminemos tus datos.</li>
          <li><strong>Portabilidad:</strong> recibir tus datos en formato descargable.</li>
          <li><strong>Oposición:</strong> oponerte a un tratamiento concreto.</li>
        </ul>
        <p>También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es) si consideras que tus derechos no han sido atendidos.</p>
      </Section>

      <Card className="p-4 sm:p-5">
        <h2 className="text-heading text-ink">Solicitar baja del club</h2>
        <Notice
          tone="warn"
          icon={<TriangleAlert />}
          className="mt-3"
        >
          Si quieres darte de baja y solicitar la eliminación de tus datos, escríbenos por el chat de soporte indicando que deseas causar baja. Lo gestionaremos en un plazo máximo de 30 días.
        </Notice>
        <Link href="/student/chat" className={buttonVariants({ variant: 'danger', className: 'mt-4 w-full sm:w-auto' })}>
          Solicitar baja por chat
        </Link>
      </Card>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-2 text-body text-ink-2">{children}</div>
    </section>
  )
}
