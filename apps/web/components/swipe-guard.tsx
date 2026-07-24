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
        sessionStorage.setItem(LAST_ROUTE_KEY, path)
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
    }

    function onTouchMove(e: TouchEvent) {
      const absDx = Math.abs(e.touches[0].clientX - startX)
      const absDy = Math.abs(e.touches[0].clientY - startY)
      if (absDx > absDy && absDx > 10) {
        e.preventDefault()
      }
    }

    function onPopState() {
      if (window.location.pathname.startsWith('/login')) {
        const lastRoute = sessionStorage.getItem(LAST_ROUTE_KEY)
        if (lastRoute) {
          window.location.replace(lastRoute)
        }
      } else {
        saveRoute()
      }
    }

    saveRoute()
    document.addEventListener('touchstart', onTouchStart, { passive: true })
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
