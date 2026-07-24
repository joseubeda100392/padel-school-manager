'use client'

import { useEffect } from 'react'

const LAST_ROUTE_KEY = 'sg_last_route'

// Detects dedicated horizontal scroll wrappers (overflow-x-auto divs with tables).
// Excludes elements with overflow-y: auto/scroll (like <main overflow-auto>)
// which are vertical scrollers and should not allow horizontal nav gestures.
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

    function saveRoute() {
      const path = window.location.pathname
      if (!path.startsWith('/login')) {
        try { localStorage.setItem(LAST_ROUTE_KEY, path) } catch {}
      }
    }

    const origPushState = history.pushState.bind(history)
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      origPushState(...args)
      saveRoute()
    }

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      const screenW = document.documentElement.clientWidth
      const isEdge = startX < 20 || startX > screenW - 20
      if (isEdge && !isInsideHScrollContainer(e.target as Element)) {
        e.preventDefault()
      }
    }

    function onTouchMove(e: TouchEvent) {
      const absDx = Math.abs(e.touches[0].clientX - startX)
      const absDy = Math.abs(e.touches[0].clientY - startY)
      if (absDx > absDy && absDx > 5 && !isInsideHScrollContainer(e.target as Element)) {
        e.preventDefault()
      }
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
