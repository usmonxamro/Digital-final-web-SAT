'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Two site-wide helpers, mounted once in the root layout:
 *
 * 1. Visit tracker — one row in page_views per page shown (admin stats).
 * 2. Inspect guard — for everyone except admins, in production: no right-click
 *    menu, no DevTools / view-source / save / print shortcuts, no text drag.
 *    Honest limit: a determined person can still open DevTools from the
 *    browser menu — the real protection is on the server (answers are never
 *    sent before grading, questions need a started exam, admin needs a code).
 */
export function SiteGuards() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    const body = JSON.stringify({ path: pathname, ref: document.referrer || null })
    try {
      const blob = new Blob([body], { type: 'application/json' })
      if (!navigator.sendBeacon?.('/api/track', blob)) throw new Error('no beacon')
    } catch {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(
        () => {},
      )
    }
  }, [pathname])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    let active = true
    let cleanup = () => {}

    fetch('/api/auth/me')
      .then((r) => r.json())
      .catch(() => ({}))
      .then((d) => {
        if (!active || d?.user?.isAdmin) return

        const onContext = (e: MouseEvent) => e.preventDefault()
        const onKey = (e: KeyboardEvent) => {
          const k = e.key.toLowerCase()
          const mod = e.ctrlKey || e.metaKey
          if (
            k === 'f12' ||
            (mod && e.shiftKey && ['i', 'j', 'c', 'k', 'm'].includes(k)) ||
            (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(k)) ||
            (mod && ['u', 's', 'p'].includes(k))
          ) {
            e.preventDefault()
            e.stopPropagation()
          }
        }
        const onDrag = (e: DragEvent) => {
          if ((e.target as HTMLElement)?.tagName === 'IMG') e.preventDefault()
        }
        document.addEventListener('contextmenu', onContext)
        document.addEventListener('keydown', onKey, true)
        document.addEventListener('dragstart', onDrag)
        cleanup = () => {
          document.removeEventListener('contextmenu', onContext)
          document.removeEventListener('keydown', onKey, true)
          document.removeEventListener('dragstart', onDrag)
        }
      })

    return () => {
      active = false
      cleanup()
    }
  }, [])

  return null
}
