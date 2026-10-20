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
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.75rem)] z-[100] mx-auto flex max-w-sm items-center gap-3 rounded-card bg-chrome px-4 py-3 text-chrome-ink shadow-overlay md:inset-x-auto md:bottom-6 md:right-6"
    >
      <p className="min-w-0 flex-1 text-label text-white">Hay una versión nueva de la app</p>
      <button
        type="button"
        onClick={handleUpdate}
        className="h-9 shrink-0 rounded-control bg-accent px-3 text-label text-accent-on transition-colors hover:bg-accent-hover"
      >
        Actualizar
      </button>
    </div>
  )
}
