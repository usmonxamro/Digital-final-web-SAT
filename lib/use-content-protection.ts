import { useEffect } from 'react'

/**
 * Best-effort deterrents against casual right-click-save, view-source, and
 * print-to-PDF while active. IMPORTANT: none of this can block a determined
 * person (OS-level screenshots, browser dev tools, or a phone camera always
 * work) — it only removes the easy, one-click ways to grab the content.
 */
export function useContentProtection(active: boolean) {
  useEffect(() => {
    if (!active) return

    function blockContextMenu(e: MouseEvent) {
      e.preventDefault()
    }

    function blockShortcuts(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const blockedCombo =
        (e.ctrlKey || e.metaKey) && ['s', 'p', 'u'].includes(key) // save, print, view-source
      const devtoolsKey =
        key === 'f12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key))
      if (blockedCombo || devtoolsKey) {
        e.preventDefault()
      }
    }

    document.addEventListener('contextmenu', blockContextMenu)
    document.addEventListener('keydown', blockShortcuts)
    return () => {
      document.removeEventListener('contextmenu', blockContextMenu)
      document.removeEventListener('keydown', blockShortcuts)
    }
  }, [active])
}
