'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function ClubManageButton({ clubId }: { clubId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleManage() {
    setLoading(true)
    await fetch('/api/superadmin/active-club', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId }),
    })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Button onClick={handleManage} loading={loading} size="sm">
      Gestionar
    </Button>
  )
}
