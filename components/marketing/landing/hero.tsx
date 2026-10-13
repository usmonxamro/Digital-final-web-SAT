'use client'

import { Play, SquarePlay, Star } from 'lucide-react'
import { MarketingButton } from '@/components/marketing/button'
import { HeroDemo } from '@/components/marketing/landing/hero-demo'

export function Hero() {
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

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full sp-glass text-[13px] font-semibold text-sp-text mb-5">
              <span className="w-2 h-2 rounded-full bg-sp-green sp-pulse-green" />
              Bluebook 2026 Standarti
            </div>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex gap-0.5 text-sp-yellow">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <span className="text-[13px] text-sp-text-muted">4.9/5 (1,200+ o&apos;quvchi tomonidan baholangan)</span>
            </div>

            <h1 className="text-[2.1rem] md:text-[3.1rem] font-extrabold leading-[1.12] tracking-tight text-sp-text">
              Haqiqiy SAT imtihoni muhiti — <span className="text-sp-green">aniq</span> va{' '}
              <span className="sp-gradient-text-orange">adaptiv</span>
            </h1>
            <p className="mt-5 max-w-[540px] text-[16.5px] leading-relaxed text-sp-text-muted">
              22 daqiqalik modullar, o&apos;rnatilgan Desmos kalkulyatori, reference formula varag&apos;i
              hamda natijalaringizni aniq shkala bo&apos;yicha hisoblab beruvchi aqlli platforma.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <MarketingButton href="/login" variant="green" className="px-7 py-3.5 text-[15px]">
                <Play size={15} /> Bepul Mock Ishlash
              </MarketingButton>
              <MarketingButton href="#darslar" variant="glass" className="px-7 py-3.5 text-[15px]">
                <SquarePlay size={16} className="text-red-500" /> Darsliklar
              </MarketingButton>
            </div>
          </div>

          {/* Looping silent demo — Desmos solve → correct → score → certificate */}
          <HeroDemo />
        </div>
      </div>
    </section>
  )
}
