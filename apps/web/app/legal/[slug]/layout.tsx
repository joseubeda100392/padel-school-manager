import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getClubLegalInfo } from '@/lib/get-club-legal'

const LINKS = [
  { href: 'aviso-legal', label: 'Aviso legal' },
  { href: 'condiciones', label: 'Condiciones de compra' },
  { href: 'privacidad', label: 'Privacidad' },
  { href: 'cookies', label: 'Cookies' },
]

export default async function LegalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  const info = await getClubLegalInfo(params.slug)
  if (!info) notFound()

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-500">{info.clubName}</p>
          <h1 className="text-xl font-bold text-gray-900">Información legal</h1>
        </div>

        <nav className="mb-6 flex flex-wrap gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={`/legal/${params.slug}/${l.href}`}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-brand-300 hover:text-brand-600"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </div>
  )
}
