'use client'

import { useEffect } from 'react'

const LAST_ROUTE_KEY = 'sg_last_route'

function isInsideHScrollContainer(el: Element | null): boolean {
  while (el && el !== document.documentElement) {
    const style = window.getComputedStyle(el)
    if (
      (style.overflowX === 'scroll' || style.overflowX === 'auto') &&
      el.scrollWidth > el.clientWidth + 1
    ) return true
    el = el.parentElement
  }
  return false
}

// Reads env(safe-area-inset-*) via a probe element and stores the results
// as both an inline CSS variable on <html> AND as a <style> tag — two
// independent persistence mechanisms in case Next.js clears one of them.
// Also re-runs on every navigation to recover from any brief env()=0 window.
function lockSafeAreas() {
  const probe = document.createElement('div')
  probe.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:1px',
    'height:1px',
    'visibility:hidden',
    'pointer-events:none',
    'padding-top:env(safe-area-inset-top,0px)',
    'padding-bottom:env(safe-area-inset-bottom,0px)',
  ].join(';')
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const sat = cs.paddingTop || '0px'
  const sab = cs.paddingBottom || '0px'
  document.body.removeChild(probe)

  // Primary: inline style on <html>
  document.documentElement.style.setProperty('--sat', sat)
  document.documentElement.style.setProperty('--sab', sab)

  // Secondary: <style> tag fallback (survives if React clears inline styles)
  let tag = document.getElementById('__sat__') as HTMLStyleElement | null
  if (!tag) {
    tag = document.createElement('style')
    tag.id = '__sat__'
    document.head.appendChild(tag)
  }
  tag.textContent = `:root{--sat:${sat};--sab:${sab}}`

  // Temporary debug overlay — remove once the bug is confirmed fixed
  let dbg = document.getElementById('__sat_dbg__')
  if (!dbg) {
    dbg = document.createElement('div')
    dbg.id = '__sat_dbg__'
    dbg.style.cssText = [
      'position:fixed',
      'bottom:68px',
      'right:4px',
      'background:rgba(0,0,0,0.85)',
      'color:#0f0',
      'padding:3px 6px',
      'font-size:9px',
      'z-index:99999',
      'border-radius:3px',
      'font-family:monospace',
      'pointer-events:none',
      'line-height:1.4',
    ].join(';')
    document.body.appendChild(dbg)
  }
  const vpMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content ?? '?'
  const hasViewportFit = vpMeta.includes('viewport-fit')
  dbg.innerHTML = [
    `top: ${sat}`,
    `bot: ${sab}`,
    `viewport-fit: ${hasViewportFit ? '<span style="color:#0f0">✓</span>' : '<span style="color:#f00">✗</span>'}`,
  ].join('<br>')
}

export function SwipeGuard() {
  useEffect(() => {
    lockSafeAreas()

    let startX = 0, startY = 0, decided = false, blocking = false

    function saveRoute() {
      const path = window.location.pathname
      if (!path.startsWith('/login')) {
        try { localStorage.setItem(LAST_ROUTE_KEY, path) } catch {}
      }
    }

    const origPushState = history.pushState.bind(history)
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      history.replaceState(...args)
      saveRoute()
      // Re-lock safe areas after Next.js navigation in case env() briefly returned 0
      requestAnimationFrame(lockSafeAreas)
    }

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX; startY = e.touches[0].clientY
      decided = false; blocking = false
      const screenW = document.documentElement.clientWidth
      if (startX < 30 || startX > screenW - 30) {
        e.preventDefault(); decided = true; blocking = true
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (decided) { if (blocking) e.preventDefault(); return }
      const absDx = Math.abs(e.touches[0].clientX - startX)
      const absDy = Math.abs(e.touches[0].clientY - startY)
      if (absDx < 5 && absDy < 5) return
      decided = true
      blocking = absDx > absDy && !isInsideHScrollContainer(e.target as Element)
      if (blocking) e.preventDefault()
    }
    function onPopState() {
      if (window.location.pathname.startsWith('/login')) {
        try {
          const lastRoute = localStorage.getItem(LAST_ROUTE_KEY)
          if (lastRoute) { window.location.replace(lastRoute); return }
        } catch {}
        window.history.go(1)
      } else {
        saveRoute()
      }
    }

    saveRoute()
    document.addEventListener('touchstart', onTouchStart, { passive: false })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('popstate', onPopState)

    return () => {
      history.pushState = origPushState
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  return null
}
