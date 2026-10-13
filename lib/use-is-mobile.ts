'use client'

import { useEffect, useState } from 'react'

/** True below the `md` breakpoint (matches Tailwind's 768px). Used by the
 *  exam UI to switch floating/side-by-side layouts (calculator, passage
 *  split) into stacked/full-width mobile ones. SSR-safe: starts `false` and
 *  corrects itself on mount, then tracks resizes/orientation changes. */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [breakpoint])

  return isMobile
}
