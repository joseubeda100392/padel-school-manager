'use client'

import { useEffect, useState } from 'react'

const CHECK_INTERVAL_MS = 5 * 60 * 1000

export function UpdateChecker({ currentVersion }: { currentVersion: string }) {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    if (currentVersion === 'dev') return

    async function check() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        const { version } = await res.json()
        if (version && version !== currentVersion) setHasUpdate(true)
      } catch {
        // sin conexión o error puntual — no molestar al usuario
      }
    }

    check()
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    // visibilitychange es poco fiable en PWAs iOS en modo standalone al
    // volver de segundo plano — focus y pageshow (bfcache) cubren ese hueco
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
    }
  }, [currentVersion])

  function handleUpdate() {
    const bust = `_v=${Date.now()}`
    const separator = window.location.search ? '&' : '?'
    window.location.href = `${window.location.pathname}${window.location.search}${separator}${bust}`
  }

  if (!hasUpdate) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-sm rounded-xl bg-gray-900 px-4 py-3 text-white shadow-lg sm:left-auto sm:right-4">
      <p className="text-sm font-medium">Hay una versión nueva de la app disponible</p>
      <button
        onClick={handleUpdate}
        className="mt-2 w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold hover:bg-brand-600"
      >
        Actualizar ahora
      </button>
    </div>
  )
}
