import { ResultScreen } from '../result-screen'

export default function MandateKoPage() {
  return (
    <ResultScreen
      tone="danger"
      title="Pago no completado"
      description="No hemos podido procesar tu pago. Contacta con tu club para más información."
    />
  )
}
