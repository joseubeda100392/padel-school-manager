import { notFound } from 'next/navigation'
import { DesignPreview } from './design-preview'

// Muestrario interno del sistema de diseño (design.md). Nunca en producción.
export default function DesignPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <DesignPreview />
}
