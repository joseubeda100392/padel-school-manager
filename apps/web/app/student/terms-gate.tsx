'use client'

import { useId, useState } from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'

type Props = {
  pdfUrl: string
  clubName: string
}

export function TermsGate({ pdfUrl, clubName }: Props) {
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const checkId = useId()

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  async function handleAccept() {
    if (!accepted) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/student/accept-terms', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      setLoading(false)
      if (!res.ok) {
        setError(`Error ${res.status}: ${body?.error ?? JSON.stringify(body)}`)
        return
      }
      window.location.replace('/student')
    } catch (e: unknown) {
      setLoading(false)
      setError(`Excepción: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <img src="/icon.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
        <p className="mt-4 text-meta text-ink-3">{clubName}</p>
        <h1 className="mt-0.5 font-display text-title text-ink">Condiciones de uso</h1>
        <p className="mt-2 text-body text-ink-2">
          Antes de acceder a la aplicación debes leer y aceptar las condiciones de uso del club.
        </p>

        {typeof pdfUrl === 'string' && pdfUrl ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => { window.open('/api/pdf/normas', '_blank') }}
              className="flex min-h-14 w-full items-center gap-3 rounded-control border border-line-strong/60 bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <FileText className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-label text-ink">Leer las condiciones de uso</span>
                <span className="block text-meta text-ink-3">Se abre en una pestaña nueva</span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            </button>
            <a
              href="/api/pdf/normas"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center text-label text-accent-ink underline underline-offset-4"
            >
              Si no se abre, abre el documento desde este enlace
            </a>
          </div>
        ) : (
          <div className="mt-6 flex h-24 items-center justify-center rounded-control border border-dashed border-line-strong/60 bg-surface-2 px-4 text-center">
            <p className="text-body text-ink-3">El club no ha subido aún el documento de condiciones.</p>
          </div>
        )}

        <div className="mt-6 flex items-start gap-3">
          <input
            id={checkId}
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-line-strong accent-accent-ink"
          />
          <label htmlFor={checkId} className="cursor-pointer text-body text-ink">
            He leído y acepto las condiciones de uso de <strong>{clubName}</strong>
          </label>
        </div>

        {error && <Notice tone="danger" className="mt-4">{error}</Notice>}

        <Button onClick={handleAccept} disabled={!accepted} loading={loading} size="lg" block className="mt-6">
          Aceptar y continuar
        </Button>

        <Button onClick={handleLogout} loading={loggingOut} variant="ghost" block className="mt-2">
          No acepto, cerrar sesión
        </Button>
      </Card>
    </main>
  )
}
