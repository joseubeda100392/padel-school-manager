import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-white">
            <span className="text-lg font-bold">P</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Padel School Manager</h1>
            <p className="text-sm text-gray-500">Panel de Administración</p>
          </div>
        </div>

        <p className="mb-8 text-gray-600">
          Gestiona tu escuela de pádel: reservas, alumnos, pagos, niveles y mucho más.
        </p>

        <Link
          href="/dashboard"
          className="block w-full rounded-lg bg-brand-500 py-3 text-center font-medium text-white transition hover:bg-brand-600"
        >
          Acceder al Panel
        </Link>
      </div>
    </main>
  )
}
