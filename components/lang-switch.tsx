'use client'

import { LANGS } from '@/lib/i18n'
import { useI18n } from '@/components/i18n-provider'

/** Compact UZ | RU | EN switch with a sliding highlight (landing, login, dashboard). */
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n()
  const idx = Math.max(0, LANGS.findIndex((l) => l.code === lang))
  return (
    <div className={`sp-lang ${className}`} role="group" aria-label="Language">
      <i style={{ transform: `translateX(${idx * 100}%)` }} />
      {LANGS.map((l) => (
        <button key={l.code} type="button" onClick={() => setLang(l.code)} aria-pressed={l.code === lang} title={l.native}>
          {l.label}
        </button>
      ))}
    </div>
  )
}
