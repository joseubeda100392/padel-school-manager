'use client'

import { useEffect } from 'react'

const LAST_ROUTE_KEY = 'sg_last_route'

export function SwipeGuard() {
  useEffect(() => {
    let startX = 0
    let startY = 0
    let gestureDecided = false
    let blockGesture = false

    function saveRoute() {
      const path = window.location.pathname
      if (!path.startsWith('/login')) {
        // localStorage persists across PWA sessions (unlike sessionStorage)
        try { localStorage.setItem(LAST_ROUTE_KEY, path) } catch {}
      }
    }

    // Track route on Next.js client navigation
    const origPushState = history.pushState.bind(history)
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      origPushState(...args)
      saveRoute()
    }

    // passive: false on BOTH listeners — required for preventDefault to work on iOS
    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      gestureDecided = false
      blockGesture = false
    }

    function onTouchMove(e: TouchEvent) {
      if (gestureDecided) {
        if (blockGesture) e.preventDefault()
        return
      }
      const absDx = Math.abs(e.touches[0].clientX - startX)
      const absDy = Math.abs(e.touches[0].clientY - startY)
      if (absDx < 5 && absDy < 5) return // not enough movement yet
      gestureDecided = true
      blockGesture = absDx > absDy // horizontal → block
      if (blockGesture) e.preventDefault()
    }

    // Fallback: if navigation still reaches /login, redirect back
    function onPopState() {
      if (window.location.pathname.startsWith('/login')) {
        try {
          const lastRoute = localStorage.getItem(LAST_ROUTE_KEY)
          if (lastRoute) {
            window.location.replace(lastRoute)
            return
          }
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
