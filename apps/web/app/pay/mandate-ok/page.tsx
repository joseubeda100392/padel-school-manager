export default function MandateOkPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Domiciliación activada</h1>
        <p className="mt-2 text-sm text-gray-500">
          Tu pago se ha procesado correctamente. A partir de ahora tu cuota mensual se cobrará automáticamente.
        </p>
        <a href="/dashboard" className="mt-6 inline-block rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600">
          Volver al panel
        </a>
      </div>
    </div>
  )
}
