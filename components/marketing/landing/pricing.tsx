import { Check, Zap, Crown } from 'lucide-react'
import { MarketingButton } from '@/components/marketing/button'
import { Reveal } from '@/components/marketing/reveal'

const FREE = ['Standard Practice Testlar', 'Cheklangan Question Bank', 'Desmos kalkulyatori']

const PRO = [
  'Real Adaptive Module 2 (Hard/Easy)',
  "To'liq SAT Question Bank (Barcha skilllar)",
  'Aniq SAT Score Calculator (Shkala)',
  "Click va Payme orqali to'lov",
]

export function Pricing() {
  return (
    <section id="tarif" className="py-20 md:py-24 font-jakarta">
      <div className="max-w-[1200px] mx-auto px-6">
        <Reveal>
          <div className="text-center max-w-[560px] mx-auto mb-14">
            <h2 className="text-[1.9rem] md:text-[2.3rem] font-extrabold text-sp-text">Shaffof Tariflar</h2>
            <p className="mt-3 text-sp-text-muted text-[15.5px]">
              O&apos;zingizga mos rejani tanlang va tayyorgarlikni hoziroq boshlang
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-6 max-w-[760px] mx-auto">
          <Reveal>
            <div className="sp-glass sp-hover-glow-green rounded-2xl p-8 h-full">
              <h3 className="text-[20px] font-bold text-sp-text">Free Plan</h3>
              <p className="text-sp-text-muted text-[13.5px] mt-1">Boshlang&apos;ich amaliyot uchun</p>
              <div className="mt-5 text-[32px] font-extrabold text-sp-text">
                0 <span className="text-[15px] font-semibold text-sp-text-muted">UZS</span>
              </div>
              <ul className="mt-6 space-y-2.5">
                {FREE.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-[14px] text-sp-text-muted">
                    <Check size={15} className="text-sp-green shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <MarketingButton href="/login" variant="glass" className="w-full mt-7">
                Boshlash
              </MarketingButton>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="relative rounded-2xl p-8 h-full border-2 border-sp-yellow bg-[linear-gradient(165deg,rgba(245,158,11,0.08),transparent)] sp-glass sp-hover-glow-gold">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11.5px] font-extrabold text-[#1A1200] bg-[linear-gradient(135deg,var(--sp-yellow),var(--sp-yellow-glow))]">
                <Crown size={13} /> MOST POPULAR
              </div>
              <h3 className="text-[20px] font-bold text-sp-text mt-2">PRO Adaptive</h3>
              <p className="text-sp-text-muted text-[13.5px] mt-1">To&apos;liq imtihon simulyatsiyasi</p>
              <div className="mt-5 text-[32px] font-extrabold text-sp-text">
                99 000 <span className="text-[15px] font-semibold text-sp-text-muted">UZS / oy</span>
              </div>
              <ul className="mt-6 space-y-2.5">
                {PRO.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-[14px] text-sp-text-muted">
                    <Check size={15} className="text-sp-yellow shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <MarketingButton href="/login" variant="green" className="w-full mt-7">
                <Zap size={14} /> PRO Obunani Yoqish
              </MarketingButton>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
