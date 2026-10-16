import { ResultScreen } from '../result-screen'

export default function MandateOkPage() {
  return (
    <ResultScreen
      tone="success"
      title="Pago automático activado"
      description="Tu pago se ha procesado correctamente y tu tarjeta ha quedado guardada. A partir de ahora tus cuotas se cobrarán solas cada mes."
      action={{ href: '/student/schedule', label: 'Volver a mis clases' }}
    />
  )
}
