import { notFound } from 'next/navigation'
import { getClubLegalInfo } from '@/lib/get-club-legal'
import { LegalSection } from '../section'

export default async function PrivacidadPage({ params }: { params: { slug: string } }) {
  const info = await getClubLegalInfo(params.slug)
  if (!info) notFound()

  return (
    <div>
      <LegalSection title="Responsable del tratamiento">
        <p>{info.companyName}{info.cif ? ` (${info.cif})` : ''}{info.address ? `, ${info.address}` : ''}.</p>
        {info.email && <p>Email de contacto: {info.email}</p>}
      </LegalSection>

      <LegalSection title="¿Qué datos tratamos?">
        <ul className="list-disc space-y-1 pl-5">
          <li>Datos identificativos: nombre, email, teléfono.</li>
          <li>Historial de clases, asistencia y nivel de juego.</li>
          <li>Movimientos de bolsa de créditos y pagos realizados.</li>
          <li>Mensajes enviados a través del chat de soporte de la plataforma.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Finalidad y legitimación">
        <p>
          Tratamos tus datos para gestionar tu inscripción y asistencia a clases, procesar los pagos contratados y
          atender tus consultas. La base legal es la ejecución del contrato de prestación de servicios entre el alumno
          y {info.companyName}.
        </p>
      </LegalSection>

      <LegalSection title="Destinatarios">
        <p>
          Tus datos no se ceden a terceros salvo obligación legal. Para procesar los pagos se comparten los datos
          estrictamente necesarios con Redsys, la pasarela de pago de las entidades bancarias españolas, que actúa como
          encargado del tratamiento.
        </p>
      </LegalSection>

      <LegalSection title="Conservación">
        <p>
          Conservamos tus datos mientras seas alumno del club. Si causas baja, se eliminan en un plazo máximo de 30
          días, salvo obligación legal de conservación (por ejemplo, registros contables de pagos).
        </p>
      </LegalSection>

      <LegalSection title="Tus derechos">
        <p>
          Puedes ejercer en cualquier momento los derechos de acceso, rectificación, supresión, portabilidad y
          oposición escribiendo a {info.email || 'el email de contacto del club'}. También puedes reclamar ante la
          Agencia Española de Protección de Datos (aepd.es) si consideras que tus derechos no han sido atendidos.
        </p>
      </LegalSection>
    </div>
  )
}
