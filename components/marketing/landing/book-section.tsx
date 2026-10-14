'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Lock, Crown, Eye } from 'lucide-react'
import { BookCover } from '@/components/marketing/landing/book-cover'
import { BookPreviewModal } from '@/components/marketing/landing/book-preview-modal'
import { Reveal } from '@/components/marketing/reveal'
import { MarketingButton } from '@/components/marketing/button'
import { useT } from '@/components/i18n-provider'

// TODO(Usmon): kitobingizning PDF faylini public/book.pdf sifatida qo'ying —
// shu manzil bo'yicha avtomatik topiladi. Muqova hozircha shu faylning birinchi
// sahifasidan olinadi (keyinchalik alohida muqova rasmi qo'yish mumkin).
const BOOK_PDF_URL = '/book.pdf'

export function BookSection() {
  const t = useT()
  const [previewOpen, setPreviewOpen] = useState(false)
  // Is the book file uploaded? (null = still checking). Without it the preview button would only show an error.
  const [hasPdf, setHasPdf] = useState<boolean | null>(null)
  useEffect(() => {
    let off = false
    fetch(BOOK_PDF_URL, { method: 'HEAD' })
      .then((r) => !off && setHasPdf(r.ok))
      .catch(() => !off && setHasPdf(false))
    return () => {
      off = true
    }
  }, [])

  return (
    <section className="py-12 md:py-[86px]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-5 md:gap-8 items-stretch">
          {/* Left: the book */}
          <Reveal>
            <div className="sp-glass sp-hover-glow-green rounded-2xl p-5 sm:p-7 h-full flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start">
              <div className="w-[112px] sm:w-[160px] shrink-0 rounded-lg overflow-hidden shadow-[0_20px_40px_-16px_rgba(0,0,0,0.5)] aspect-[3/4] bg-sp-input">
                <BookCover pdfUrl={BOOK_PDF_URL} className="w-full h-full" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-sp-green bg-sp-green/10 px-2.5 py-1 rounded-full">
                  <BookOpen size={12} /> {t('Mualliflik kitobi')}
                </span>
                <h3 className="text-[18px] sm:text-[20px] font-extrabold text-sp-text mt-2.5">
                  {t("Usmon Xamroyev bilan SAT'ga tayyorgarlik")}
                </h3>
                <p className="text-[14px] text-sp-text-muted mt-2 leading-relaxed">
                  {t("Real imtihon tajribasiga asoslangan strategiya va misollar to'plami.")}
                </p>
                {hasPdf === false ? (
                  <span className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-[10px] font-bold text-[13px] text-sp-text-muted border border-sp-border bg-sp-input">
                    {t('Tez orada')}
                  </span>
                ) : (
                  <button
                    onClick={() => setPreviewOpen(true)}
                    className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-[10px] font-bold text-[13.5px] text-white bg-[linear-gradient(135deg,var(--sp-green),var(--sp-green-glow))]"
                  >
                    <Eye size={15} /> {t("Kitobni ko'rish")}
                  </button>
                )}
              </div>
            </div>
          </Reveal>

          {/* Right: locked premium course block */}
          <Reveal delay={120}>
            <div className="relative rounded-2xl p-5 sm:p-7 h-full flex flex-col justify-center items-center text-center overflow-hidden border-2 border-sp-yellow/40 bg-[linear-gradient(165deg,rgba(245,158,11,0.08),transparent)] sp-glass sp-hover-glow-gold">
              <div className="w-14 h-14 rounded-2xl bg-sp-yellow/15 flex items-center justify-center text-sp-yellow mb-4">
                <Lock size={24} />
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-extrabold text-[#1A1200] bg-[linear-gradient(135deg,var(--sp-yellow),var(--sp-yellow-glow))] px-3 py-1 rounded-full mb-3">
                <Crown size={12} /> PREMIUM
              </span>
              <h3 className="text-[18px] sm:text-[20px] font-extrabold text-sp-text">{t('800/800 Math kurs darslari')}</h3>
              <p className="text-[14px] text-sp-text-muted mt-2 max-w-[320px]">
                {t("Eng yuqori ballga olib boruvchi video darslar to'plami — faqat Premium obunachilar uchun.")}
              </p>
              <MarketingButton href="/login" variant="gold" className="mt-5">
                {t("Premium'ga o'tish")}
              </MarketingButton>
            </div>
          </Reveal>
        </div>
      </div>

      {previewOpen && <BookPreviewModal pdfUrl={BOOK_PDF_URL} onClose={() => setPreviewOpen(false)} />}
    </section>
  )
}
