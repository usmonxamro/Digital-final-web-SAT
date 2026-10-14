'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/components/i18n-provider'

const PHRASES = [
  'Bepul mock ishlang.',
  'Tekin dars oling.',
  'Haqiqiy SAT muhitida mashq qiling.',
  'Natijangizni 1600 shkalada ko‘ring.',
  'Har kuni bir qadam.',
]

/** Types a phrase, holds it, erases it, then moves on to the next one. */
export function Typewriter() {
  const { t, lang } = useI18n()
  const [text, setText] = useState('')

  useEffect(() => {
    let i = 0
    let n = 0
    let erasing = false
    let timer: ReturnType<typeof setTimeout>
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setText(t(PHRASES[0]))
      return
    }
    const tick = () => {
      const phrase = t(PHRASES[i])
      if (!erasing) {
        n++
        setText(phrase.slice(0, n))
        if (n === phrase.length) {
          erasing = true
          timer = setTimeout(tick, 1400)
          return
        }
        timer = setTimeout(tick, 70)
      } else {
        n--
        setText(phrase.slice(0, n))
        if (n === 0) {
          erasing = false
          i = (i + 1) % PHRASES.length
          timer = setTimeout(tick, 350)
          return
        }
        timer = setTimeout(tick, 32)
      }
    }
    timer = setTimeout(tick, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  return (
    <div className="mb-5 flex items-center gap-3 text-[15px] md:text-[17px] font-bold text-sp-text" aria-live="off">
      <span className="text-sp-green tracking-wide">SAT AKADEMIYASI</span>
      <span className="h-5 w-px bg-sp-border" />
      <span className="min-h-[1.6em] text-sp-orange">
        {text}
        <span className="sp-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-sp-orange" />
      </span>
    </div>
  )
}
