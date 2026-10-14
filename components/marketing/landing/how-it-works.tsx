'use client'

import { ChartColumn, ClipboardCheck, UserPlus } from 'lucide-react'
import { Reveal } from '@/components/marketing/reveal'
import { useT } from '@/components/i18n-provider'

const STEPS = [
  { icon: UserPlus, n: '01', title: 'Ro‘yxatdan o‘ting', desc: 'Google yoki email orqali bir daqiqada hisob yarating — bepul.' },
  { icon: ClipboardCheck, n: '02', title: 'Mock ishlang', desc: 'Haqiqiy Bluebook muhitida Reading & Writing va Math modullarini yeching.' },
  { icon: ChartColumn, n: '03', title: 'Natijani kuzating', desc: '1600 shkalada ball, xatolar tahlili va sertifikat — barchasi bir joyda.' },
]

export function HowItWorks() {
  const t = useT()
  return (
    <section id="how" className="py-11 md:py-[86px] font-jakarta">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <Reveal>
          <div className="text-center max-w-[560px] mx-auto mb-8 md:mb-14">
            <h2 className="text-[1.5rem] sm:text-[1.9rem] md:text-[2.3rem] font-extrabold text-sp-text">{t('Qanday ishlaydi?')}</h2>
            <p className="mt-2 md:mt-3 text-sp-text-muted text-[14px] md:text-[15.5px]">{t('3 oddiy qadamda natijaga erishing')}</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5 relative">
          {STEPS.map(({ icon: Icon, n, title, desc }, i) => (
            <Reveal key={n} delay={i * 100}>
              <div className="sp-glass sp-hover-glow-green relative h-full rounded-2xl p-5 sm:p-7">
                <span className="absolute right-6 top-5 text-[2.4rem] font-extrabold leading-none text-sp-text/10">{n}</span>
                <div className="mb-4 flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-xl border border-sp-green/30 bg-sp-green/10 text-sp-green">
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
