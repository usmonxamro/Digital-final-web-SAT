'use client'

import { useEffect, useState } from 'react'
import { MoonStar, Sun } from 'lucide-react'

/**
 * Day/night switch (sun | moon pill) — one component for the landing page, login,
 * dashboard and admin. Writes `data-sp-theme` on <html> and `sp-theme` in localStorage.
 * `defaultTheme` is used only when the visitor has never chosen one (admin starts light).
 */
export function ThemeSwitch({ defaultTheme, className = '' }: { defaultTheme?: 'light' | 'dark'; className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem('sp-theme')
    } catch {
      /* private mode */
    }
    if (defaultTheme && saved !== 'light' && saved !== 'dark') {
      document.documentElement.setAttribute('data-sp-theme', defaultTheme)
    }
    setDark(document.documentElement.getAttribute('data-sp-theme') !== 'light')
  }, [defaultTheme])

  function toggle() {
    const next = dark ? 'light' : 'dark'
    setDark(next === 'dark')
    document.documentElement.setAttribute('data-sp-theme', next)
    try {
      localStorage.setItem('sp-theme', next)
    } catch {
      /* private mode */
    }
  }

  return (
    <button
      type="button"
      className={`sp-theme ${className}`}
      onClick={toggle}
      aria-pressed={!!dark}
      aria-label={dark ? 'Kunduzgi rejimga o‘tish' : 'Tungi rejimga o‘tish'}
      title={dark ? 'Kunduzgi rejimni yoqish' : 'Tungi rejimni yoqish'}
    >
      <span className={dark === false ? 'sp-on' : ''}>
        <Sun />
      </span>
      <span className={dark ? 'sp-on' : ''}>
        <MoonStar />
      </span>
    </button>
  )
}
