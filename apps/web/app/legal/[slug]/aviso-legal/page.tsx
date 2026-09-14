import { notFound } from 'next/navigation'
import { getClubLegalInfo } from '@/lib/get-club-legal'
import { LegalSection, LegalMissingData } from '../section'

export default async function AvisoLegalPage({ params }: { params: { slug: string } }) {
  const info = await getClubLegalInfo(params.slug)
  if (!info) notFound()

  const missing = [
    !info.cif && 'CIF/NIF',
    !info.address && 'Dirección',
    !info.email && 'Email de contacto',
  ].filter(Boolean) as string[]

  return (
    <div>
      {missing.length > 0 && <LegalMissingData fields={missing} />}

      <LegalSection title="Titular">
        <p><strong>Denominación social:</strong> {info.companyName}</p>
        {info.cif && <p><strong>CIF/NIF:</strong> {info.cif}</p>}
        {info.address && <p><strong>Domicilio:</strong> {info.address}</p>}
        {info.email && <p><strong>Email de contacto:</strong> {info.email}</p>}
        {info.phone && <p><strong>Teléfono:</strong> {info.phone}</p>}
      </LegalSection>

      <LegalSection title="Objeto">
        <p>
          {info.companyName} pone a disposición de sus alumnos y usuarios la plataforma de gestión de {info.clubName} para la
          reserva y pago de clases de pádel, bonos de clases y cuotas mensuales, así como la comunicación con el club.
        </p>
      </LegalSection>

      <LegalSection title="Condiciones de uso">
        <p>
          El acceso a esta plataforma requiere registro previo por parte del club. El usuario se compromete a hacer un uso
          adecuado de los contenidos y servicios, a no emplearlos para fines ilícitos y a facilitar información veraz en
          los formularios de contacto y registro.
        </p>
      </LegalSection>

      <LegalSection title="Propiedad intelectual">
        <p>
          Los contenidos de esta plataforma (textos, imágenes, diseño) son propiedad de {info.companyName} o de terceros que
          han autorizado su uso, y están protegidos por la normativa de propiedad intelectual e industrial.
        </p>
      </LegalSection>

      <LegalSection title="Legislación aplicable">
        <p>
          Las presentes condiciones se rigen por la legislación española. Para cualquier controversia derivada del uso de
          esta plataforma, las partes se someten a los juzgados y tribunales que correspondan según la normativa de
          consumidores y usuarios.
        </p>
      </LegalSection>
    </div>
  )
}
