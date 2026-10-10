import { ResultScreen } from '../result-screen'

export default function MandateOkPage() {
  return (
    <ResultScreen
      tone="success"
      title="Domiciliación activada"
      description="Tu pago se ha procesado correctamente. A partir de ahora tu cuota mensual se cobrará automáticamente."
      action={{ href: '/dashboard', label: 'Volver al panel' }}
    />
  )
}
