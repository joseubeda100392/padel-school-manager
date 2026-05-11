'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function MarkNotificationsRead() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/notifications/mark-read', { method: 'POST' }).then(() => {
      router.refresh()
    })
  }, [])

  return null
}
