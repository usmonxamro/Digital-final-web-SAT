'use client'

import { useState } from 'react'
import { Play, ListVideo } from 'lucide-react'
import { VideoModal } from '@/components/marketing/landing/video-modal'
import { Reveal } from '@/components/marketing/reveal'
import { useT } from '@/components/i18n-provider'

const VIDEOS = [
  { id: '_Mx0OD1bB1Y', title: 'SAT darsi 1' },
  { id: 'WtczMM7IddQ', title: 'SAT darsi 2' },
  { id: '7MGRkDzygT0', title: 'SAT darsi 3' },
  { id: 'OZa5PQJwNBM', title: 'SAT darsi 4' },
]

const PLAYLISTS = [
  { id: 'PLEHWZXX9t0NY', title: "SAT Math to'plami" },
  { id: 'PLuU3OhSpr-WW5r7M45Cv0rFsS20TFfeLN', title: "SAT Reading & Writing to'plami" },
]

export function DemoLessons() {
  const t = useT()
  const [modalSrc, setModalSrc] = useState<string | null>(null)

  return (
    <section id="darslar" className="py-20 md:py-24">
      <div className="max-w-[1200px] mx-auto px-6">
        <Reveal>
          <div className="text-center max-w-[560px] mx-auto mb-12">
            <h2 className="text-[1.9rem] md:text-[2.3rem] font-extrabold text-sp-text">
              {t('Video Darslar')}
            </h2>
            <p className="mt-3 text-sp-text-muted text-[15.5px]">
              {t('YouTube kanalimizdagi darslarni saytdan chiqmasdan tomosha qiling')}
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
          {VIDEOS.map((v, i) => (
            <Reveal key={v.id} delay={i * 80}>
              <button
                onClick={() =>
                  setModalSrc(`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1`)
                }
                className="group w-full text-left sp-glass sp-hover-glow-green rounded-2xl overflow-hidden"
              >
                <div className="relative aspect-video bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`}
                    alt={t(v.title)}
                    className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="w-12 h-12 rounded-full bg-sp-green flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play size={16} className="text-white ml-0.5" fill="currentColor" />
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-[14px] font-bold text-sp-text leading-snug">{t(v.title)}</div>
                </div>
              </button>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <h3 className="text-[18px] font-bold text-sp-text mb-5">{t('Pleylistlar')}</h3>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-5">
          {PLAYLISTS.map((p, i) => (
            <Reveal key={p.id} delay={i * 100}>
              <button
                onClick={() =>
                  setModalSrc(`https://www.youtube-nocookie.com/embed/videoseries?list=${p.id}&autoplay=1`)
                }
                className="group w-full flex items-center gap-4 sp-glass sp-hover-glow-green rounded-2xl p-5 text-left"
              >
                <div className="w-14 h-14 rounded-xl bg-sp-green/10 flex items-center justify-center text-sp-green shrink-0 group-hover:scale-105 transition-transform">
                  <ListVideo size={24} />
                </div>
                <div>
                  <div className="text-[15px] font-bold text-sp-text">{t(p.title)}</div>
                  <div className="text-[12.5px] text-sp-text-muted mt-0.5">{t("To'liq pleylistni ko'rish")}</div>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {modalSrc && <VideoModal src={modalSrc} onClose={() => setModalSrc(null)} />}
    </section>
  )
}
