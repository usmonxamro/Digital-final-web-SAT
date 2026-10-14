'use client'

import { useT } from '@/components/i18n-provider'
import { LangSwitch } from '@/components/lang-switch'
import { ThemeSwitch } from '@/components/marketing/theme-switch'
import { Logo } from '@/components/marketing/logo'
import { MarketingButton } from '@/components/marketing/button'

export function LandingHeader() {
  const t = useT()
  return (
    <header className="sticky top-0 z-50 border-b border-sp-border bg-sp-header backdrop-blur-md font-jakarta">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-2 px-4 sm:px-6 h-16 md:h-[72px]">
        <Logo subtitle={false} compact />
        <nav className="hidden md:flex items-center gap-8 text-[14.5px] font-medium text-sp-text-muted">
          <a href="#imkoniyat" className="hover:text-sp-text transition-colors">{t('Imkoniyatlar')}</a>
          <a href="#how" className="hover:text-sp-text transition-colors">{t('Qanday ishlaydi')}</a>
          <a href="#darslar" className="hover:text-sp-text transition-colors">{t('Video darslar')}</a>
          <a href="#tarif" className="hover:text-sp-text transition-colors">{t('Tariflar')}</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitch />
          <ThemeSwitch />
          <MarketingButton href="/login" variant="green" className="px-4 sm:px-6 py-2 text-[13.5px]">
            {t('Kirish')}
          </MarketingButton>
        </div>
      </div>
    </header>
  )
}
