'use client'

import { useEffect } from 'react'

export function SwipeGuard() {
  useEffect(() => {
    let startX = 0
    let startY = 0

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      const absDx = Math.abs(e.touches[0].clientX - startX)
      const absDy = Math.abs(e.touches[0].clientY - startY)
      const screenW = document.documentElement.clientWidth
      const fromLeftEdge = startX < 60
      const fromRightEdge = startX > screenW - 60

      if ((fromLeftEdge || fromRightEdge) && absDx > absDy && absDx > 10) {
        e.preventDefault()
      }
    }

    // Fallback: if a back/forward swipe lands on /login despite gesture prevention,
    // push forward immediately so the user stays in the app
    function onPopState() {
      if (window.location.pathname.startsWith('/login')) {
        window.history.go(1)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('popstate', onPopState)

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  return null
}
