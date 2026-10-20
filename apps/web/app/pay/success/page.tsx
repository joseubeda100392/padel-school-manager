import { ResultScreen } from '../result-screen'

export default function PaySuccessPage() {
  return (
    <ResultScreen
      tone="success"
      title="Pago completado"
      description="Tu pago se ha procesado correctamente."
      action={{ href: '/student', label: 'Volver a la app' }}
    />
  )
}
