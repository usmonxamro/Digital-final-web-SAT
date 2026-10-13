'use client'

import { useEffect } from 'react'

/** Counts one visit per browser session (tab), never on every page change. */
export function VisitPing() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('sd-visit')) return
      sessionStorage.setItem('sd-visit', '1')
    } catch {
      return
    }
    fetch('/api/visit', { method: 'POST', keepalive: true }).catch(() => {})
  }, [])
  return null
}
