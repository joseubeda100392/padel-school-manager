'use client'

import { useEffect } from 'react'
import { ErrorView } from '@/components/error-view'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-screen bg-gray-50">
      <ErrorView reset={reset} />
    </main>
  )
}
