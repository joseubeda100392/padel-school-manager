'use client'

import { useState, useEffect } from 'react'
import { Check, CircleCheck, CircleX, Clock, FileText, Search, Zap } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Notice, Skeleton } from '@/components/ui/feedback'
import { Stat } from '@/components/ui/list'
import { useConfirm } from '@/components/ui/confirm'
import { formatLongDate, formatClock } from '@/lib/format-date'

const statusTone: Record<string, 'neutral' | 'success' | 'danger'> = {
  draft: 'neutral',
  sent: 'neutral',
  converted: 'success',
  closed: 'danger',
}

const statusIcon: Record<string, React.ReactNode> = {
  draft: <FileText className="h-3.5 w-3.5" aria-hidden />,
  sent: <Clock className="h-3.5 w-3.5" aria-hidden />,
  converted: <CircleCheck className="h-3.5 w-3.5" aria-hidden />,
  closed: <CircleX className="h-3.5 w-3.5" aria-hidden />,
}

const statusLabel: Record<string, string> = {
  draft:     'Borrador',
  sent:      'Enviada',
  converted: 'Convertida',
  closed:    'Cerrada',
}

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const confirm = useConfirm()
  const [campaign, setCampaign] = useState<any>(null)
  const [levels, setLevels] = useState<any[]>([])
  const [selectedLevel, setSelectedLevel] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; waSent?: number; pushSent?: number; error?: string } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [previewError, setPreviewError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/pista-viva/campaigns?id=${params.id}`)
      .then((r) => r.json())
      .catch(() => {})

    // Load campaign from the list
    fetch('/api/admin/pista-viva/campaigns')
      .then((r) => r.json())
      .then((d) => {
        const found = (d.campaigns ?? []).find((c: any) => c.id === params.id)
        if (found) { setCampaign(found); setSelectedLevel(found.target_level_id ?? '') }
      })

    fetch('/api/admin/levels')
      .then((r) => r.json())
      .then((d) => setLevels(d.levels ?? []))
  }, [params.id])

  async function saveChanges() {
    setSaving(true)
    await fetch('/api/admin/pista-viva/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: params.id, targetLevelId: selectedLevel || null }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSend() {
    if (
      !(await confirm({
        title: 'Crear el partido y avisar a los socios',
        description: 'Se creará el partido en Playtomic y se enviará WhatsApp y notificación push a los socios. No se puede deshacer.',
        confirmLabel: 'Crear y enviar',
      }))
    )
      return
    setSending(true)
    setSendResult(null)
    try {
      if (selectedLevel !== (campaign?.target_level_id ?? '')) {
        await fetch('/api/admin/pista-viva/campaigns', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: params.id, targetLevelId: selectedLevel || null }),
        })
      }

      const res = await fetch(`/api/admin/pista-viva/campaigns/${params.id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setSendResult({ ok: false, error: data.error }); return }
      setSendResult({ ok: true, waSent: data.waSent, pushSent: data.pushSent })
      setCampaign((prev: any) => ({ ...prev, status: 'sent', playtomic_match_url: data.matchUrl }))
    } catch {
      setSendResult({ ok: false, error: 'Error de conexión' })
    } finally {
      setSending(false)
    }
  }

  async function handlePreview() {
    setPreviewing(true)
    setPreview(null)
    setPreviewError('')
    try {
      const res = await fetch(`/api/admin/pista-viva/campaigns/${params.id}/send?dry_run=1`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setPreviewError(data.error ?? 'Error al hacer la prueba'); return }
      setPreview(data.preview ?? data)
    } catch {
      setPreviewError('Error de conexión')
    } finally {
      setPreviewing(false)
    }
  }

  function copyLink() {
    const url = attributionUrl
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    } else {
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!campaign) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const slotDate = new Date(campaign.slot_datetime)
  const dateStr = formatLongDate(slotDate)
  const timeStr = formatClock(slotDate)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const attributionUrl = `${baseUrl}/pv/${params.id}`

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        back={{ href: '/dashboard/pista-viva', label: 'Pista Viva' }}
        title={campaign.court_name}
        actions={
          <Badge tone={statusTone[campaign.status] ?? 'neutral'} className="self-center">
            {statusIcon[campaign.status]}
            {statusLabel[campaign.status] ?? campaign.status}
          </Badge>
        }
      />

      <Card>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <Stat label="Fecha y hora" value={<span className="text-heading font-sans">{dateStr} · {timeStr}</span>} />
          <Stat label="Duración" value={`${campaign.duration_minutes} min`} />
          <Stat label="Jugadores" value={`${campaign.players_joined} / ${campaign.players_needed}`} />
          <Stat label="Clics en enlace" value={campaign.click_count} />
        </div>
      </Card>

      {campaign.status !== 'draft' && (
        <Card>
          <CardBody className="space-y-3">
            <Field label="Enlace de atribución">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={attributionUrl} className="font-mono text-meta" />
                <Button variant="secondary" onClick={copyLink} className="w-full sm:w-auto">
                  {copied && <Check className="h-4 w-4" aria-hidden />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </Field>
            {campaign.playtomic_match_url && (
              <p className="text-meta text-ink-3">
                Partido en Playtomic:{' '}
                <a href={campaign.playtomic_match_url} target="_blank" rel="noopener noreferrer" className="text-accent-ink hover:underline">
                  Ver partido
                </a>
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {campaign.status === 'draft' && (
        <Card>
          <CardHeader title="Enviar campaña" />
          <CardBody className="space-y-4">
            <Field label="Nivel objetivo" hint="Opcional. Si lo dejas vacío, se avisa a todos los socios.">
              <Select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
                <option value="">Todos los socios</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </Field>

            <div className="flex justify-end">
              <Button variant="secondary" onClick={saveChanges} loading={saving} className="w-full sm:w-auto">
                {!saving && saved && <Check className="h-4 w-4" aria-hidden />}
                {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar cambios'}
              </Button>
            </div>

            {sendResult && !sendResult.ok && (
              <p role="alert" className="text-meta font-medium text-danger-ink">{sendResult.error}</p>
            )}
            {sendResult?.ok && (
              <Notice tone="success" icon={<CircleCheck />}>
                Enviado. WhatsApp: {sendResult.waSent} · Push: {sendResult.pushSent}
              </Notice>
            )}

            <div className="space-y-2 rounded-control border border-dashed border-line-strong/60 p-3">
              <Button variant="secondary" block onClick={handlePreview} loading={previewing}>
                {!previewing && <Search className="h-4 w-4" aria-hidden />}
                {previewing ? 'Consultando Playtomic…' : 'Vista previa (no crea partido ni cobra nada)'}
              </Button>
              {previewError && <p role="alert" className="text-meta font-medium text-danger-ink">{previewError}</p>}
              {preview && (
                <pre className="max-h-64 overflow-auto rounded-control bg-chrome p-3 text-meta leading-snug text-chrome-ink">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              )}
            </div>

            <Button block size="lg" onClick={handleSend} loading={sending}>
              {!sending && <Zap className="h-4 w-4" aria-hidden />}
              {sending ? 'Creando partido y enviando…' : 'Crear partido y enviar WhatsApp y push'}
            </Button>
            <p className="text-center text-meta text-ink-3">
              Se creará un partido abierto en Playtomic y se avisará a los socios con el enlace directo.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
