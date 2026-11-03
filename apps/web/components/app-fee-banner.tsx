'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Landmark } from 'lucide-react'
import { Notice } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
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

function PaymentDetails({ bank, concept }: { bank: AppFeeBank | null; concept: string }) {
  if (!bank) return <p className="mt-1">Escríbenos y te pasamos los datos para el pago.</p>
  return (
    <div className="mt-1.5 flex flex-col gap-1 text-body">
      <span>Titular: <span className="font-medium">{bank.holder}</span></span>
      <CopyValue label="IBAN" value={bank.iban} />
      <CopyValue label="Concepto" value={concept} />
      {bank.bizum && <CopyValue label="O por Bizum al" value={bank.bizum} />}
    </div>
  )
}

const REMINDER_KEY = 'app-fee-reminder'

// Cuota de la app que el club nos debe: solo la ve el admin del club (y el super
// admin cuando gestiona ese club). Desaparece cuando marcamos los meses como pagados.
export function AppFeeBanner({ status, bank, clubName, canNotify }: AppFeeBannerProps) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [reminderOpen, setReminderOpen] = useState(false)
  const concept = `${clubName} · ePadel School · ${status.label}`
  const due = DATE.format(new Date(`${status.dueDate}T00:00:00Z`))
  const amount = formatCurrency(Math.round(status.total * 100))
  const lockDay = status.lockDate ? DATE.format(new Date(`${status.lockDate}T00:00:00Z`)) : null

  // Ventana una vez por sesión del navegador (no en cada pantalla).
  useEffect(() => {
    if (!status.reminder || !canNotify) return
    try {
      if (sessionStorage.getItem(REMINDER_KEY) === status.label) return
      sessionStorage.setItem(REMINDER_KEY, status.label)
    } catch {
      // sin sessionStorage (modo privado): se muestra igualmente
    }
    setReminderOpen(true)
  }, [status.reminder, status.label, canNotify])

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
    setReminderOpen(false)
    router.refresh()
  }

  const notifyButton = canNotify && (
    <Button size="sm" variant="secondary" onClick={notify} loading={sending} className="w-full sm:w-auto">
      Ya he pagado
    </Button>
  )

  return (
    <>
      <Notice tone={status.overdue && !status.notified ? 'danger' : 'warn'} icon={<Landmark />} className="mb-4 print:hidden">
        <p className="font-medium">Cuota de ePadel School pendiente: {status.label} · {amount}</p>
        {status.notified ? (
          <p className="mt-1">Nos has avisado del pago. Este aviso se quitará cuando lo recibamos.</p>
        ) : (
          <>
            {status.locked && canNotify && (
              <p className="mt-1 font-medium">
                Panel bloqueado por falta de pago: puedes ver tus datos, pero no dar altas, apuntar cobros ni cambiar clases
                hasta que nos avises del pago. Tus alumnos y monitores siguen usando la app con normalidad.
              </p>
            )}
            <p className="mt-1">
              {status.overdue ? `Vencida desde el ${due}.` : `Págala antes del ${due}.`}{bank && (bank.bizum ? ' Haz una transferencia o un Bizum con estos datos:' : ' Haz una transferencia con estos datos:')}
            </p>
            {status.overdue && lockDay && !status.locked && (
              <p className="mt-1">Si no nos llega aviso, desde el {lockDay} no podrás dar altas, apuntar cobros ni cambiar clases.</p>
            )}
            <PaymentDetails bank={bank} concept={concept} />
            {canNotify && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {notifyButton}
                {error && <span className="text-meta">{error}</span>}
              </div>
            )}
          </>
        )}
      </Notice>
      <Sheet
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        title={`Cuota de ePadel School vencida: ${amount}`}
        description={`${status.label} · vencida desde el ${due}`}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setReminderOpen(false)} className="w-full sm:w-auto">Ahora no</Button>
            {notifyButton}
          </div>
        }
      >
        <div className="text-body text-ink-2">
          <p>Haz el pago y pulsa «Ya he pagado».</p>
          {lockDay && !status.locked && (
            <p className="mt-1.5">
              Si no, desde el {lockDay} podrás seguir viendo tus datos, pero no dar altas, apuntar cobros ni cambiar clases.
              Tus alumnos y monitores no notarán nada.
            </p>
          )}
          <PaymentDetails bank={bank} concept={concept} />
          {error && <p role="alert" className="mt-2 text-meta text-danger-ink">{error}</p>}
        </div>
      </Sheet>
    </>
  )
}
