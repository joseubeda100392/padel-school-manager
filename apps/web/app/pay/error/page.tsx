import { ResultScreen } from '../result-screen'

export default function PayErrorPage() {
  return (
    <ResultScreen
      tone="danger"
      title="No se ha completado el pago"
      description="No se ha cobrado nada. Vuelve a la app e inténtalo de nuevo."
      action={{ href: '/student', label: 'Volver a la app' }}
    />
  )
}
