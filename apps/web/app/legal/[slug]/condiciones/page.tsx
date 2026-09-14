import { notFound } from 'next/navigation'
import { getClubLegalInfo } from '@/lib/get-club-legal'
import { LegalSection } from '../section'

export default async function CondicionesPage({ params }: { params: { slug: string } }) {
  const info = await getClubLegalInfo(params.slug)
  if (!info) notFound()

  return (
    <div>
      <LegalSection title="Objeto y precio">
        <p>
          A través de la plataforma de {info.clubName}, los alumnos pueden contratar clases sueltas, bonos de clases y
          cuotas mensuales de grupos fijos. El precio de cada servicio se muestra antes de confirmar el pago e incluye
          todos los impuestos aplicables.
        </p>
      </LegalSection>

      <LegalSection title="Forma de pago">
        <p>
          El pago se realiza mediante tarjeta bancaria a través del TPV virtual (Redsys), la pasarela de pago segura de
          las entidades bancarias españolas. {info.clubName} no almacena en ningún momento los datos de la tarjeta —
          estos se introducen directamente en la página segura del banco.
        </p>
      </LegalSection>

      <LegalSection title="Cancelación de clases">
        <p>
          El alumno puede cancelar una clase puntual reservada con una antelación mínima de {info.cancellationHours} horas
          respecto al inicio de la clase, sin coste. Las cancelaciones realizadas con menos antelación, o las
          inasistencias no comunicadas, podrán suponer la pérdida de la clase o crédito de bolsa correspondiente, salvo
          que el club decida lo contrario en un caso concreto.
        </p>
      </LegalSection>

      <LegalSection title="Derecho de desistimiento">
        <p>
          De acuerdo con el artículo 103 del Real Decreto Legislativo 1/2007 (Texto Refundido de la Ley General para la
          Defensa de los Consumidores y Usuarios), el derecho de desistimiento no resulta de aplicación a la prestación
          de servicios ya ejecutados, total o parcialmente, con el consentimiento previo y expreso del consumidor. Al
          contratar una clase, bono o cuota con fecha de inicio determinada, el alumno consiente expresamente el inicio
          de la prestación del servicio en esa fecha.
        </p>
        <p>
          En cualquier caso, si el alumno desea cancelar una contratación antes de que el servicio haya comenzado, puede
          solicitarlo escribiendo a {info.email || 'la dirección de contacto del club'} y se le reembolsará el importe
          correspondiente a la parte del servicio no prestada.
        </p>
      </LegalSection>

      <LegalSection title="Reembolsos">
        <p>
          Cuando proceda un reembolso, este se realizará utilizando el mismo medio de pago empleado por el alumno,
          mediante la propia pasarela Redsys, en un plazo máximo de 14 días naturales desde que se autorice la
          devolución.
        </p>
      </LegalSection>

      <LegalSection title="Bajas de alumnos fijos">
        <p>
          Un alumno inscrito en un grupo fijo puede solicitar su baja comunicándolo antes del día 15 del mes en curso,
          y la baja será efectiva a partir del mes siguiente. Si la solicitud se realiza el día 15 o después, la baja
          será efectiva a partir del segundo mes siguiente (es decir, se debe abonar también la cuota del mes
          inmediatamente posterior).
        </p>
        <p>
          La cuota ya abonada del mes en curso no es reembolsable, salvo circunstancias excepcionales que el club
          valorará de forma individual.
        </p>
      </LegalSection>

      <LegalSection title="Reclamaciones">
        <p>
          Cualquier incidencia o reclamación relacionada con un pago o servicio puede dirigirse a{' '}
          {info.email || 'el email de contacto del club'}
          {info.phone ? ` o al teléfono ${info.phone}` : ''}. {info.companyName} dispone de hojas de reclamaciones a
          disposición del alumno.
        </p>
      </LegalSection>
    </div>
  )
}
