import { Layers, Calculator, TrendingUp } from 'lucide-react'
import { Reveal } from '@/components/marketing/reveal'

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
  return (
    <section id="imkoniyat" className="py-20 md:py-24 font-jakarta">
      <div className="max-w-[1200px] mx-auto px-6">
        <Reveal>
          <div className="text-center max-w-[560px] mx-auto mb-14">
            <h2 className="text-[1.9rem] md:text-[2.3rem] font-extrabold text-sp-text">
              Nima uchun bizning platforma?
            </h2>
            <p className="mt-3 text-sp-text-muted text-[15.5px]">
              Aynan raqamli SAT imtihonida yuqori ball olish uchun kerakli barcha vositalar
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, color, title, desc }, i) => (
            <Reveal key={title} delay={i * 100}>
              <div className="sp-glass sp-hover-glow-green rounded-2xl p-7">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 border ${
                    color === 'orange'
                      ? 'text-sp-orange bg-sp-orange/10 border-sp-orange/30'
                      : 'text-sp-green bg-sp-green/10 border-sp-green/30'
                  }`}
                >
                  <Icon size={21} />
                </div>
                <h3 className="text-[18px] font-bold text-sp-text">{title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-sp-text-muted">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
