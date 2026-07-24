'use client'

import { useEffect } from 'react'

function hasHorizontalScroll(el: Element | null): boolean {
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el)
    const overflow = style.overflowX
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollWidth > el.clientWidth) {
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
    let shouldBlock = false

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      shouldBlock = false
    }

    function onTouchMove(e: TouchEvent) {
      if (shouldBlock) {
        e.preventDefault()
        return
      }
      const absDx = Math.abs(e.touches[0].clientX - startX)
      const absDy = Math.abs(e.touches[0].clientY - startY)

      if (absDx > absDy && absDx > 8) {
        if (!hasHorizontalScroll(e.target as Element)) {
          shouldBlock = true
          e.preventDefault()
        }
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
