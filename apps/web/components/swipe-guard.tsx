'use client'

import { useEffect } from 'react'

const LAST_ROUTE_KEY = 'sg_last_route'

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
      // Call preventDefault HERE in touchstart so iOS UIKit never activates
      // its edge pan gesture recognizer — this is the only reliable way
      const screenW = document.documentElement.clientWidth
      if (startX < 20 || startX > screenW - 20) {
        e.preventDefault()
      }
    }

    function onTouchMove(e: TouchEvent) {
      const absDx = Math.abs(e.touches[0].clientX - startX)
      const absDy = Math.abs(e.touches[0].clientY - startY)
      if (absDx > absDy && absDx > 5) {
        e.preventDefault()
      }
    }

    // Last resort: if iOS gesture still navigates to /login, redirect back
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
