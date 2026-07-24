'use client'

import { useEffect } from 'react'

// Only matches dedicated horizontal scroll wrappers (overflow-x-auto divs).
// Excludes elements that also scroll vertically (like <main overflow-auto>),
// which would otherwise match and allow all horizontal swipes.
function isInsideHScrollContainer(el: Element | null): boolean {
  while (el && el !== document.documentElement) {
    const style = window.getComputedStyle(el)
    const overflowX = style.overflowX
    const overflowY = style.overflowY
    if (
      (overflowX === 'scroll' || overflowX === 'auto') &&
      (overflowY === 'visible' || overflowY === 'hidden') &&
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
        if (!isInsideHScrollContainer(e.target as Element)) {
          e.preventDefault()
        }
      }
    }

    // Fallback: if a swipe lands on /login despite gesture prevention, go forward
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
