'use client'

import { useEffect, useState } from 'react'
import { MoonStar, Sun } from 'lucide-react'
import { useT } from '@/components/i18n-provider'

/**
 * Day/night switch — ONE round icon button (sun while it is dark, moon while it is light) that flips
 * to the other mode. Shared by landing, login, dashboard and admin. Writes `data-sp-theme` on <html>
 * and `sp-theme` in localStorage. `defaultTheme` is used only when the visitor has never chosen one.
 */
export function ThemeSwitch({ defaultTheme, className = '' }: { defaultTheme?: 'light' | 'dark'; className?: string }) {
  const t = useT()
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

  const label = dark ? t('Kunduzgi rejimga o‘tish') : t('Tungi rejimga o‘tish')
  return (
    <button type="button" className={`sp-theme ${className}`} data-mode={dark === false ? 'light' : 'dark'} onClick={toggle} aria-label={label} title={label}>
      <Sun className="sp-sun" />
      <MoonStar className="sp-moon" />
    </button>
  )
}
