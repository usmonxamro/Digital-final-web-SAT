'use client'

import { useState } from 'react'
import { BookOpen, Lock, Crown, Eye } from 'lucide-react'
import { BookCover } from '@/components/marketing/landing/book-cover'
import { BookPreviewModal } from '@/components/marketing/landing/book-preview-modal'
import { Reveal } from '@/components/marketing/reveal'
import { MarketingButton } from '@/components/marketing/button'

// TODO(Usmon): kitobingizning PDF faylini public/book.pdf sifatida qo'ying —
// shu manzil bo'yicha avtomatik topiladi. Muqova hozircha shu faylning birinchi
// sahifasidan olinadi (keyinchalik alohida muqova rasmi qo'yish mumkin).
const BOOK_PDF_URL = '/book.pdf'

export function BookSection() {
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <section className="py-20 md:py-24">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-8 items-stretch">
          {/* Left: the book */}
          <Reveal>
            <div className="sp-glass sp-hover-glow-green rounded-2xl p-7 h-full flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              <div className="w-[140px] sm:w-[160px] shrink-0 rounded-lg overflow-hidden shadow-[0_20px_40px_-16px_rgba(0,0,0,0.5)] aspect-[3/4] bg-sp-input">
                <BookCover pdfUrl={BOOK_PDF_URL} className="w-full h-full" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-sp-green bg-sp-green/10 px-2.5 py-1 rounded-full">
                  <BookOpen size={12} /> Mualliflik kitobi
                </span>
                <h3 className="text-[20px] font-extrabold text-sp-text mt-3">
                  Usmon Xamroyev bilan SAT&apos;ga tayyorgarlik
                </h3>
                <p className="text-[14px] text-sp-text-muted mt-2 leading-relaxed">
                  Real imtihon tajribasiga asoslangan strategiya va misollar to&apos;plami.
                </p>
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-[10px] font-bold text-[13.5px] text-white bg-[linear-gradient(135deg,var(--sp-green),var(--sp-green-glow))]"
                >
                  <Eye size={15} /> Kitobni ko&apos;rish
                </button>
              </div>
            </div>
          </Reveal>

          {/* Right: locked premium course block */}
          <Reveal delay={120}>
            <div className="relative rounded-2xl p-7 h-full flex flex-col justify-center items-center text-center overflow-hidden border-2 border-sp-yellow/40 bg-[linear-gradient(165deg,rgba(245,158,11,0.08),transparent)] sp-glass sp-hover-glow-gold">
              <div className="w-14 h-14 rounded-2xl bg-sp-yellow/15 flex items-center justify-center text-sp-yellow mb-4">
                <Lock size={24} />
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-extrabold text-[#1A1200] bg-[linear-gradient(135deg,var(--sp-yellow),var(--sp-yellow-glow))] px-3 py-1 rounded-full mb-3">
                <Crown size={12} /> PREMIUM
              </span>
              <h3 className="text-[20px] font-extrabold text-sp-text">800/800 Math kurs darslari</h3>
              <p className="text-[14px] text-sp-text-muted mt-2 max-w-[320px]">
                Eng yuqori ballga olib boruvchi video darslar to&apos;plami — faqat Premium
                obunachilar uchun.
              </p>
              <MarketingButton href="/login" variant="gold" className="mt-5">
                Premium&apos;ga o&apos;tish
              </MarketingButton>
            </div>
          </Reveal>
        </div>
      </div>

      {previewOpen && <BookPreviewModal pdfUrl={BOOK_PDF_URL} onClose={() => setPreviewOpen(false)} />}
    </section>
  )
}
