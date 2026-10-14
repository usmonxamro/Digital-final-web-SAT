'use client'

import { useT } from '@/components/i18n-provider'
import { CONTACT_EMAIL, SITE_DOMAIN, SITE_URL, TG_CHANNELS, TG_PERSONAL, TG_PERSONAL_URL } from '@/lib/contact'

export function LandingFooter() {
  const t = useT()
  const link = 'text-sp-text-muted hover:text-sp-green transition-colors'
  return (
    <footer className="bg-sp-footer border-t border-sp-border py-10 font-jakarta">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] font-semibold">
          <a href={SITE_URL} className={link}>{SITE_DOMAIN}</a>
          {TG_CHANNELS.map((c) => (
            <a key={c.handle} href={c.url} target="_blank" rel="noopener noreferrer" className={link}>{c.handle}</a>
          ))}
          <a href={TG_PERSONAL_URL} target="_blank" rel="noopener noreferrer" className={link}>{TG_PERSONAL}</a>
          <a href={`mailto:${CONTACT_EMAIL}`} className={link}>{CONTACT_EMAIL}</a>
        </div>
        <p className="mt-5 text-center text-[13px] text-sp-text-muted">
          {t('© 2026 SAT Akademiyasi — Usmon Xamroyev. Bluebook Precision & Adaptive Intelligence.')}
        </p>
      </div>
    </footer>
  )
}
