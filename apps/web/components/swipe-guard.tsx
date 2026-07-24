'use client'

import { useEffect } from 'react'

const LAST_ROUTE_KEY = 'sg_last_route'

function isInsideHScrollContainer(el: Element | null): boolean {
  while (el && el !== document.documentElement) {
    const style = window.getComputedStyle(el)
    if (
      (style.overflowX === 'scroll' || style.overflowX === 'auto') &&
      (style.overflowY === 'visible' || style.overflowY === 'hidden') &&
      el.scrollWidth > el.clientWidth + 1
    ) {
      return true
    }
    el = el.parentElement
  }
  return false
}

export function SwipeGuard() {
  useEffect(() => {
    let startX = 0
    let startY = 0
    let decided = false
    let blocking = false

    function saveRoute() {
      const path = window.location.pathname
      if (!path.startsWith('/login')) {
        try { localStorage.setItem(LAST_ROUTE_KEY, path) } catch {}
      }
    }

    // Layer 1 (primary): Flatten the history stack.
    // All Next.js client-side navigations become replaceState instead of pushState.
    // The history stack stays at depth 1, so iOS WKWebView's back/forward gesture
    // finds no in-app entries to navigate to — it either exits the PWA or is a no-op.
    // This is the only reliable fix because iOS can capture edge gestures before JS fires.
    const origPushState = history.pushState.bind(history)
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      history.replaceState(...args)
      saveRoute()
    }

    // Layer 2 (secondary): block touch gestures at the screen edge.
    // Sometimes iOS fires touchstart before committing to the gesture — catch those cases.
    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      decided = false
      blocking = false
      const screenW = document.documentElement.clientWidth
      if (startX < 30 || startX > screenW - 30) {
        e.preventDefault()
        decided = true
        blocking = true
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (decided) {
        if (blocking) e.preventDefault()
        return
      }
      const absDx = Math.abs(e.touches[0].clientX - startX)
      const absDy = Math.abs(e.touches[0].clientY - startY)
      if (absDx < 5 && absDy < 5) return
      decided = true
      blocking = absDx > absDy && !isInsideHScrollContainer(e.target as Element)
      if (blocking) e.preventDefault()
    }

    // Layer 3 (fallback): if any popstate lands on /login, redirect back.
    // Handles old accumulated history entries from before this fix.
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
