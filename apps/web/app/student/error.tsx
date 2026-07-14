'use client'

import { useEffect } from 'react'
import { ErrorView } from '@/components/error-view'

export default function SectionError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return <ErrorView reset={reset} />
}
