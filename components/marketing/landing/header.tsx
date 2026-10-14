'use client'

import { Zap } from 'lucide-react'
import { useT } from '@/components/i18n-provider'
import { LangSwitch } from '@/components/lang-switch'
import { ThemeSwitch } from '@/components/marketing/theme-switch'
import { Logo } from '@/components/marketing/logo'
import { MarketingButton } from '@/components/marketing/button'

export function LandingHeader() {
  const t = useT()
  return (
    <header className="sticky top-0 z-50 border-b border-sp-border bg-sp-header backdrop-blur-md font-jakarta">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-4 sm:px-6 h-20">
        <Logo subtitle={false} compact />
        <nav className="hidden md:flex items-center gap-8 text-[14.5px] font-medium text-sp-text-muted">
          <a href="#imkoniyat" className="hover:text-sp-text transition-colors">{t('Imkoniyatlar')}</a>
          <a href="#how" className="hover:text-sp-text transition-colors">{t('Qanday ishlaydi')}</a>
          <a href="#darslar" className="hover:text-sp-text transition-colors">{t('Video darslar')}</a>
          <a href="#tarif" className="hover:text-sp-text transition-colors">{t('Tariflar')}</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitch className="hidden sm:inline-grid" />
          <ThemeSwitch />
          <MarketingButton href="/login" variant="glass" className="px-3.5 sm:px-5">
            {t('Kirish')}
          </MarketingButton>
          <MarketingButton href="/login?mode=signup" variant="green">
            <Zap size={14} className="hidden sm:block" /> {t("Ro'yxatdan o'tish")}
          </MarketingButton>
        </div>
      </div>
    </header>
  )
}
