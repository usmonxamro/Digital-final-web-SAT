'use client'

import { useEffect } from 'react'

/**
 * Admin panel: one place that knows which parts of the screen hold changes that
 * are NOT saved yet (JSON edits, pictures, answer keys, a freshly pasted mock).
 * Every such part registers itself with `useUnsavedChanges`; the panel then
 *  - warns when the tab is closed / reloaded (beforeunload),
 *  - asks before switching to another admin section or following a link,
 *  - lets editors ask `confirmDiscard()` before closing themselves.
 */
type Entry = { count: number; label: string }
const store = new Map<string, Entry>()

export function totalUnsaved(): number {
  let n = 0
  for (const e of store.values()) n += e.count
  return n
}

function summary(): string {
  return [...store.values()].map((e) => `• ${e.label}`).join('\n')
}

/** true = fine to leave (nothing pending, or the admin agreed to drop it). */
export function confirmDiscard(): boolean {
  if (totalUnsaved() === 0) return true
  return window.confirm(`Saqlanmagan o'zgarishlar bor:\n\n${summary()}\n\nBaribir chiqasizmi? (Saqlanmagan o'zgarishlar yo'qoladi)`)
}

/** Registers `count` pending changes under `id` while the component is mounted. */
export function useUnsavedChanges(id: string, count: number, label: string) {
  useEffect(() => {
    if (count > 0) store.set(id, { count, label })
    else store.delete(id)
  }, [id, count, label])
  useEffect(() => () => void store.delete(id), [id])
}

/** Mount once in the admin panel: reload/close warning + internal link guard. */
export function useLeaveGuard() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (totalUnsaved() === 0) return
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e: MouseEvent) => {
      if (totalUnsaved() === 0 || e.defaultPrevented) return
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Same page, only the #hash changes: handled by the section switcher itself.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      if (!confirmDiscard()) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [])
}

/** How many questions carry a picture (question figure or an answer-option picture). */
export function countPictures(list: { image?: string; choices?: { image?: string }[] }[] | null | undefined): number {
  return (list ?? []).filter((q) => q?.image || q?.choices?.some((c) => c?.image)).length
}
