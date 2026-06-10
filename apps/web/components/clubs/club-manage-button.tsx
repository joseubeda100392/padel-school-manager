'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
    <button
      onClick={handleManage}
      disabled={loading}
      className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
    >
      {loading ? '...' : 'Gestionar'}
    </button>
  )
}
