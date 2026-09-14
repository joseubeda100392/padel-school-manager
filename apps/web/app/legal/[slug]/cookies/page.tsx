import { notFound } from 'next/navigation'
import { getClubLegalInfo } from '@/lib/get-club-legal'
import { LegalSection } from '../section'

export default async function CookiesPage({ params }: { params: { slug: string } }) {
  const info = await getClubLegalInfo(params.slug)
  if (!info) notFound()

  return (
    <div>
      <LegalSection title="¿Qué cookies usamos?">
        <p>
          Esta plataforma utiliza únicamente cookies técnicas, estrictamente necesarias para mantener tu sesión
          iniciada de forma segura. No utilizamos cookies de publicidad, analítica de terceros ni de seguimiento entre
          sitios web.
        </p>
      </LegalSection>

      <LegalSection title="Cookies técnicas propias">
        <p>
          Se generan al iniciar sesión y permiten identificarte en las siguientes visitas sin tener que volver a
          introducir tus credenciales. Son imprescindibles para el funcionamiento de la plataforma y no requieren
          consentimiento previo según la normativa vigente.
        </p>
      </LegalSection>

      <LegalSection title="Pasarela de pago">
        <p>
          Durante el proceso de pago serás redirigido a la página segura de Redsys, que puede utilizar sus propias
          cookies técnicas para completar la transacción. Esta plataforma no tiene acceso a esas cookies ni a los
          datos de tu tarjeta.
        </p>
      </LegalSection>

      <LegalSection title="Cómo desactivar las cookies">
        <p>
          Puedes configurar tu navegador para bloquear o eliminar cookies, aunque esto puede impedir el funcionamiento
          correcto de la plataforma (por ejemplo, mantener tu sesión iniciada).
        </p>
      </LegalSection>

      <LegalSection title="Contacto">
        <p>
          Para cualquier duda sobre esta política, puedes escribir a {info.email || 'el email de contacto del club'}.
        </p>
      </LegalSection>
    </div>
  )
}
