'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle({ className = '' }: { className?: string }) {
  // Starts null so we don't render the wrong icon before hydration reads
  // the real value the init script already applied to <html>.
  const [theme, setTheme] = useState<'dark' | 'light' | null>(null)

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-sp-theme')
    setTheme(current === 'light' ? 'light' : 'dark')
  }, [])

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-sp-theme', next)
    localStorage.setItem('sp-theme', next)
  }

  return (
    <button
      onClick={toggle}
      title="Rejimni o'zgartirish"
      className={`w-9 h-9 rounded-full border border-sp-border flex items-center justify-center text-sp-text hover:border-sp-green transition-colors ${className}`}
    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  )
}
