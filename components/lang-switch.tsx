'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { LANGS } from '@/lib/i18n'
import { useI18n } from '@/components/i18n-provider'

/**
 * One compact language button (globe + current code). Tapping it opens a small menu with
 * O'zbekcha / Русский / English — the three languages are never shown side by side.
 */
export function LangSwitch({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={`sp-lang ${dark ? 'sp-lang-dark' : ''} ${className}`}>
      <button type="button" className="sp-lang-btn" aria-haspopup="menu" aria-expanded={open} aria-label={current.native} onClick={() => setOpen((v) => !v)}>
        <Globe />
        {current.label}
        <ChevronDown className="sp-chev" />
      </button>
      {open && (
        <div className="sp-lang-menu" role="menu">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === lang}
              onClick={() => {
                setLang(l.code)
                setOpen(false)
              }}
            >
              <span className="sp-flag">{l.flag}</span>
              <span style={{ flex: 1 }}>{l.native}</span>
              {l.code === lang && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
