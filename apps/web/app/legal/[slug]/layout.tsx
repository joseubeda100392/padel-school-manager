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
    <div className="min-h-screen bg-canvas px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="text-label text-accent-ink">{info.clubName}</p>
          <h1 className="font-display text-title text-ink">Información legal</h1>
        </header>

        <nav aria-label="Documentos legales" className="mb-6 flex flex-wrap gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={`/legal/${params.slug}/${l.href}`}
              className="inline-flex min-h-11 items-center rounded-full border border-line-strong/60 bg-surface px-4 text-label text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">{children}</div>
      </div>
    </div>
  )
}
