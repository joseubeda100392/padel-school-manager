'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Landmark } from 'lucide-react'
import { Notice } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { AppFeeBank, AppFeeStatus } from '@/lib/app-fee'

interface AppFeeBannerProps {
  status: AppFeeStatus
  bank: AppFeeBank | null
  clubName: string
  canNotify: boolean
}

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span>{label}:</span>
      <span className="break-words font-medium">{value}</span>
      <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded px-1 text-meta underline-offset-2 hover:underline">
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </span>
  )
}

// Cuota de la app que el club nos debe: solo la ve el admin del club (y el super
// admin cuando gestiona ese club). Desaparece cuando marcamos los meses como pagados.
export function AppFeeBanner({ status, bank, clubName, canNotify }: AppFeeBannerProps) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const concept = `${clubName} · ePadel School · ${status.label}`
  const due = DATE.format(new Date(`${status.dueDate}T00:00:00Z`))

  async function notify() {
    setSending(true)
    setError('')
    const res = await fetch('/api/admin/app-fee/notify', { method: 'POST' }).catch(() => null)
    if (!res?.ok) {
      const body = await res?.json().catch(() => null)
      setError(body?.error ?? 'No se pudo enviar el aviso. Inténtalo de nuevo.')
      setSending(false)
      return
    }
    router.refresh()
  }

  return (
    <Notice tone={status.overdue && !status.notified ? 'danger' : 'warn'} icon={<Landmark />} className="mb-4 print:hidden">
      <p className="font-medium">
        Cuota de ePadel School pendiente: {status.label} · {formatCurrency(Math.round(status.total * 100))}
      </p>
      {status.notified ? (
        <p className="mt-1">Nos has avisado de la transferencia. Este aviso se quitará cuando la recibamos.</p>
      ) : (
        <>
          <p className="mt-1">
            {status.overdue ? `Vencida desde el ${due}.` : `Págala antes del ${due}.`}{bank && ' Haz una transferencia con estos datos:'}
          </p>
          {bank ? (
            <div className="mt-1.5 flex flex-col gap-1 text-body">
              <span>Titular: <span className="font-medium">{bank.holder}</span></span>
              <CopyValue label="IBAN" value={bank.iban} />
              <CopyValue label="Concepto" value={concept} />
            </div>
          ) : (
            <p className="mt-1">Escríbenos y te pasamos los datos para la transferencia.</p>
          )}
          {canNotify && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={notify} loading={sending} className="w-full sm:w-auto">
                Ya he hecho la transferencia
              </Button>
              {error && <span className="text-meta">{error}</span>}
            </div>
          )}
        </>
      )}
    </Notice>
  )
}
