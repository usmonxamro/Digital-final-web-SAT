'use client'

import { Layers, Calculator, TrendingUp } from 'lucide-react'
import { Reveal } from '@/components/marketing/reveal'
import { useT } from '@/components/i18n-provider'

const FEATURES = [
  {
    icon: Layers,
    color: 'green',
    title: 'Adaptive Module 2',
    desc: "Birinchi modul natijangizga qarab 2-modul darajasi avtomatik ravishda murakkablashadi yoki osonlashadi.",
  },
  {
    icon: Calculator,
    color: 'orange',
    title: 'Integratsiyalashgan Desmos',
    desc: "Test ishlayotgan jarayoningizda ekranning o'zida Desmos grafik kalkulyatoridan to'liq foydalaning.",
  },
  {
    icon: TrendingUp,
    color: 'green',
    title: 'Aniq SAT Score Shkalasi',
    desc: "Haqiqiy College Board shkalasi bo'yicha baholash va xatolaringiz bo'yicha chuqur analitika.",
  },
]

export function Features() {
  const t = useT()
  return (
    <section id="imkoniyat" className="py-11 md:py-[86px] font-jakarta">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="text-center max-w-[560px] mx-auto mb-8 md:mb-14">
            <h2 className="text-[1.5rem] sm:text-[1.9rem] md:text-[2.3rem] font-extrabold text-sp-text">
              {t('Nima uchun bizning platforma?')}
            </h2>
            <p className="mt-2 md:mt-3 text-sp-text-muted text-[14px] md:text-[15.5px]">
              {t('Aynan raqamli SAT imtihonida yuqori ball olish uchun kerakli barcha vositalar')}
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, color, title, desc }, i) => (
            <Reveal key={title} delay={i * 100}>
              <div className="sp-glass sp-hover-glow-green rounded-2xl p-5 sm:p-7">
                <div
                  className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-4 border ${
                    color === 'orange'
                      ? 'text-sp-orange bg-sp-orange/10 border-sp-orange/30'
                      : 'text-sp-green bg-sp-green/10 border-sp-green/30'
                  }`}
                >
                  <Icon size={21} />
                </div>
                <h3 className="text-[16.5px] md:text-[18px] font-bold text-sp-text">{t(title)}</h3>
                <p className="mt-2 text-[13.5px] md:text-[14.5px] leading-relaxed text-sp-text-muted">{t(desc)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
