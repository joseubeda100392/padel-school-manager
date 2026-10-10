import { TriangleAlert } from 'lucide-react'
import { Notice } from '@/components/ui/feedback'

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <h2 className="mb-3 text-heading text-ink">{title}</h2>
      <div className="max-w-prose space-y-3 text-body text-ink-2">{children}</div>
    </section>
  )
}

export function LegalMissingData({ fields }: { fields: string[] }) {
  return (
    <Notice tone="warn" icon={<TriangleAlert />} className="mb-6">
      Falta configurar: {fields.join(', ')}. El club puede rellenarlo en Configuración, Pagos, Datos legales.
    </Notice>
  )
}
