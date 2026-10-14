'use client'

import { Play, SquarePlay, Star } from 'lucide-react'
import { MarketingButton } from '@/components/marketing/button'
import { useT } from '@/components/i18n-provider'
import { HeroDemo } from '@/components/marketing/landing/hero-demo'

export function Hero() {
  const t = useT()
  return (
    <section className="relative overflow-hidden font-jakarta">
      {/* Background glows */}
      <div
        className="absolute -top-[150px] left-[20%] w-[600px] h-[600px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, var(--sp-green-glow) 0%, transparent 70%)', opacity: 0.15 }}
      />
      <div
        className="absolute top-[350px] -right-[120px] w-[650px] h-[650px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, var(--sp-orange) 0%, transparent 70%)', opacity: 0.22 }}
      />

      <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-8 md:py-[86px]">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          <div>
            <div className="mb-3 md:mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] md:text-[15px] font-bold">
              <span className="text-sp-green tracking-wide">SAT AKADEMIYASI</span>
              <span className="h-4 w-px bg-sp-border" />
              <span className="text-sp-orange">{t('Bepul mock ishlang.')}</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full sp-glass text-[12px] md:text-[13px] font-semibold text-sp-text mb-3 md:mb-4">
              <span className="w-2 h-2 rounded-full bg-sp-green sp-pulse-green" />
              {t('Bluebook 2026 Standarti')}
            </div>

            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <div className="flex gap-0.5 text-sp-yellow">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <span className="text-[12px] md:text-[13px] text-sp-text-muted">{t("4.9/5 (1,200+ o'quvchi tomonidan baholangan)")}</span>
            </div>

            <h1 className="text-[1.65rem] sm:text-[2.1rem] md:text-[3.1rem] font-extrabold leading-[1.15] tracking-tight text-sp-text">
              {t('Haqiqiy SAT imtihoni muhiti — ')}<span className="text-sp-green">{t('aniq')}</span>{t(' va ')}
              <span className="sp-gradient-text-orange">{t('adaptiv')}</span>
            </h1>
            <p className="mt-3 md:mt-5 max-w-[540px] text-[14px] md:text-[16.5px] leading-relaxed text-sp-text-muted">
              {t("Real vaqtli modullar (32 va 35 daqiqa), o'rnatilgan Desmos kalkulyatori, formula varag'i va natijangizni aniq shkala bo'yicha hisoblab beruvchi aqlli platforma.")}
            </p>
            <div className="flex flex-wrap gap-2.5 sm:gap-4 mt-5 md:mt-8">
              <MarketingButton href="/login" variant="green" className="px-5 md:px-7 py-3 md:py-3.5 text-[14px] md:text-[15px]">
                <Play size={15} /> {t('Bepul Mock Ishlash')}
              </MarketingButton>
              <MarketingButton href="#darslar" variant="glass" className="px-5 md:px-7 py-3 md:py-3.5 text-[14px] md:text-[15px]">
                <SquarePlay size={16} className="text-red-500" /> {t('Darsliklar')}
              </MarketingButton>
            </div>
          </div>

          {/* Looping silent demo — the real exam: hover → pick answer → Desmos slides in from the left → Next */}
          <HeroDemo />
        </div>
      </div>
    </section>
  )
}
