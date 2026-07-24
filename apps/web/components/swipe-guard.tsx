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

// Reads env(safe-area-inset-*) via a probe element and stores the results
// as both an inline CSS variable on <html> AND as a <style> tag — two
// independent persistence mechanisms in case Next.js clears one of them.
// Also re-runs on every navigation to recover from any brief env()=0 window.
function updateDebug(label: string) {
  let dbg = document.getElementById('__sat_dbg__')
  if (!dbg) {
    dbg = document.createElement('div')
    dbg.id = '__sat_dbg__'
    dbg.style.cssText = [
      'position:fixed',
      'bottom:90px',
      'left:0',
      'right:0',
      'background:rgba(0,0,0,0.88)',
      'color:#0f0',
      'padding:4px 8px',
      'font-size:10px',
      'z-index:99999',
      'font-family:monospace',
      'pointer-events:none',
      'line-height:1.5',
      'white-space:pre',
    ].join(';')
    document.body.appendChild(dbg)
  }

  const header = document.querySelector<HTMLElement>('header')
  const main   = document.querySelector<HTMLElement>('main')
  const hRect  = header?.getBoundingClientRect()

  const lines = [
    `[${label}]`,
    `header.top=${hRect ? Math.round(hRect.top) : '?'}  header.h=${hRect ? Math.round(hRect.height) : '?'}`,
    `main.scrollTop=${main?.scrollTop ?? '?'}`,
    `window.scrollY=${window.scrollY}`,
    `body.scrollTop=${document.body.scrollTop}`,
    `inner h=${window.innerHeight}  vvp h=${window.visualViewport?.height ?? '?'}`,
    `vvp offsetTop=${window.visualViewport?.offsetTop ?? '?'}`,
  ]
  dbg.textContent = lines.join('\n')
}

function lockSafeAreas(label = 'init') {
  const probe = document.createElement('div')
  probe.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:1px',
    'height:1px',
    'visibility:hidden',
    'pointer-events:none',
    'padding-top:env(safe-area-inset-top,0px)',
    'padding-bottom:env(safe-area-inset-bottom,0px)',
  ].join(';')
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const sat = cs.paddingTop || '0px'
  const sab = cs.paddingBottom || '0px'
  document.body.removeChild(probe)

  document.documentElement.style.setProperty('--sat', sat)
  document.documentElement.style.setProperty('--sab', sab)

  let tag = document.getElementById('__sat__') as HTMLStyleElement | null
  if (!tag) {
    tag = document.createElement('style')
    tag.id = '__sat__'
    document.head.appendChild(tag)
  }
  tag.textContent = `:root{--sat:${sat};--sab:${sab}}`

  updateDebug(label)
}

export function SwipeGuard() {
  useEffect(() => {
    lockSafeAreas('mount')

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
      // Capture state immediately after replaceState and again after paint
      updateDebug('nav-sync')
      requestAnimationFrame(() => lockSafeAreas('nav-raf'))
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
