import Link from 'next/link'
export default function MandateKoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Pago no completado</h1>
        <p className="mt-2 text-sm text-gray-500">
          No hemos podido procesar tu pago y el pago automático no se ha activado. Puedes volver a intentarlo desde tus clases o contactar con tu club.
        </p>
        <Link href="/student/schedule" className="mt-6 inline-block rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600">
          Volver a mis clases
        </Link>
      </div>
    </div>
  )
}
