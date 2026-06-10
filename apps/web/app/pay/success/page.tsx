import Link from 'next/link'

export default function PaySuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="mb-4 text-6xl">✅</div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">¡Pago completado!</h1>
      <p className="mb-8 text-gray-500">Tu pago se ha procesado correctamente.</p>
      <Link
        href="/student"
        className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
      >
        Volver a la app
      </Link>
    </div>
  )
}
