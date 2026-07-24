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
      const dx = Math.abs(e.touches[0].clientX - startX)
      const dy = Math.abs(e.touches[0].clientY - startY)
      const isEdgeSwipe = startX < 40 || startX > window.innerWidth - 40
      if (isEdgeSwipe && dx > dy && dx > 8) {
        e.preventDefault()
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  return null
}
