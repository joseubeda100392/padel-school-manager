import Link from 'next/link'

export default function PrivacidadPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Privacidad y datos</h1>
        <p className="text-sm text-gray-500">Información sobre el tratamiento de tus datos personales</p>
      </div>

      <Section title="¿Quién trata tus datos?">
        <p>Tu club de pádel es el responsable del tratamiento de tus datos personales, de acuerdo con el Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica de Protección de Datos (LOPDGDD).</p>
      </Section>

      <Section title="¿Qué datos guardamos?">
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
          <li>Nombre y dirección de email.</li>
          <li>Historial de clases, asistencia y nivel.</li>
          <li>Movimientos de tu bolsa de créditos y pagos realizados.</li>
          <li>Mensajes enviados a través del chat de soporte.</li>
          <li>Token de notificaciones push (si las has activado).</li>
        </ul>
      </Section>

      <Section title="¿Para qué usamos tus datos?">
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
          <li>Gestionar tu inscripción y asistencia a clases.</li>
          <li>Procesar pagos y mantener el historial de tu bolsa.</li>
          <li>Enviarte notificaciones relacionadas con tus clases.</li>
          <li>Atender tus consultas a través del chat de soporte.</li>
        </ul>
        <p className="mt-3">Tus datos nunca se ceden a terceros salvo obligación legal o para procesar pagos (a través de Redsys, pasarela de pago de los bancos españoles).</p>
      </Section>

      <Section title="¿Cuánto tiempo conservamos tus datos?">
        <p>Tus datos se conservan mientras seas alumno del club. Si causas baja, se eliminan en un plazo máximo de 30 días, salvo obligación legal de conservación (por ejemplo, registros de pagos).</p>
      </Section>

      <Section title="Tus derechos">
        <p>Puedes ejercer en cualquier momento los derechos de acceso, rectificación, supresión, portabilidad y oposición escribiéndonos a través del chat de soporte.</p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 mt-2">
          <li><strong>Acceso:</strong> saber qué datos tenemos sobre ti.</li>
          <li><strong>Rectificación:</strong> corregir datos incorrectos.</li>
          <li><strong>Supresión:</strong> solicitar que eliminemos tus datos.</li>
          <li><strong>Portabilidad:</strong> recibir tus datos en formato descargable.</li>
          <li><strong>Oposición:</strong> oponerte a un tratamiento concreto.</li>
        </ul>
        <p className="mt-3">También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es) si consideras que tus derechos no han sido atendidos.</p>
      </Section>

      <div className="rounded-xl border border-red-100 bg-red-50 p-6">
        <h2 className="text-sm font-semibold text-red-800 mb-2">Solicitar baja del club</h2>
        <p className="text-sm text-red-700 mb-4">Si quieres darte de baja y solicitar la eliminación de tus datos, escríbenos por el chat de soporte indicando que deseas causar baja. Lo gestionaremos en un plazo máximo de 30 días.</p>
        <Link
          href="/student/chat"
          className="inline-block rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Solicitar baja por chat
        </Link>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}
