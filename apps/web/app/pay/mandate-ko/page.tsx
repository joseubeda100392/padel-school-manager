import { ResultScreen } from '../result-screen'

export default function MandateKoPage() {
  return (
    <ResultScreen
      tone="danger"
      title="Pago no completado"
      description="No hemos podido procesar tu pago y el pago automático no se ha activado. Puedes volver a intentarlo desde tus clases o contactar con tu club."
      action={{ href: '/student/schedule', label: 'Volver a mis clases' }}
    />
  )
}
