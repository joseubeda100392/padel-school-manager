'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const EVERY_MS = 10_000
const MAX_TRIES = 12

// Vuelve a pedir la página cada 10 s durante 2 minutos mientras el pago se confirma.
export function AutoRefresh() {
  const router = useRouter()
  useEffect(() => {
    let tries = 0
    const id = setInterval(() => {
      tries += 1
      if (tries > MAX_TRIES) return clearInterval(id)
      router.refresh()
    }, EVERY_MS)
    return () => clearInterval(id)
  }, [router])
  return null
}
