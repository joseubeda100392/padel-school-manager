import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/icon.svg" alt="ePadel School" width={48} height={48} className="mb-4 h-12 w-12 rounded-xl" />
          <h1 className="font-display text-title text-ink">{title}</h1>
          {description && <p className="mt-1.5 text-body text-ink-2">{description}</p>}
        </div>
        {children}
      </div>
    </main>
  )
}

export function BackToLogin() {
  return (
    <Link
      href="/login"
      className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-label text-ink-2 hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Volver al inicio de sesión
    </Link>
  )
}
