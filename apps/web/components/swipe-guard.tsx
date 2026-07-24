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

// Measures env(safe-area-inset-*) and stores as CSS variables on <html>.
// Needed for pt-safe / pb-safe utilities to work in PWA mode.
function lockSafeAreas() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const sat = cs.paddingTop || '0px'
  const sab = cs.paddingBottom || '0px'
  document.body.removeChild(probe)
  document.documentElement.style.setProperty('--sat', sat)
  document.documentElement.style.setProperty('--sab', sab)
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
