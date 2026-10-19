'use client'

import { useEffect, useMemo, useState } from 'react'
import { PartyPopper, X } from 'lucide-react'
import { useT } from '@/components/i18n-provider'

export const CELEBRATE_KEY = 'sd-celebrate'
export type CelebrateInfo = { label: string; score: number; outOf: number }

const COLORS = ['#ff6a00', '#ffb800', '#22c55e', '#38bdf8', '#a78bfa', '#f43f5e']

/** Festive pop-up shown once on the dashboard after the student finishes a scored mock. */
export function Celebration({ name, total }: { name: string; total: number | null }) {
  const t = useT()
  const [info, setInfo] = useState<CelebrateInfo | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CELEBRATE_KEY)
      if (!raw) return
      sessionStorage.removeItem(CELEBRATE_KEY)
      const v = JSON.parse(raw) as CelebrateInfo
      if (v && typeof v.label === 'string') setInfo(v)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!info) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setInfo(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [info])

  const pieces = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        left: (i * 97) % 100,
        delay: ((i * 53) % 100) / 100,
        dur: 2.6 + ((i * 31) % 18) / 10,
        size: 7 + ((i * 13) % 7),
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0,
        drift: ((i * 29) % 80) - 40,
      })),
    [],
  )

  if (!info) return null
  return (
    <div className="sd-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setInfo(null)}>
      <div className="sd-confetti" aria-hidden>
        {pieces.map((p, i) => (
          <i
            key={i}
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              background: p.color,
              borderRadius: p.round ? '50%' : 2,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              ['--dx' as string]: `${p.drift}px`,
            }}
          />
        ))}
      </div>
      <div className="sd-modal sd-celebrate" role="dialog" aria-modal="true" aria-label={t('Tabriklaymiz')}>
        <button className="sd-modal-close" onClick={() => setInfo(null)} aria-label={t('Yopish')}>
          <X size={15} />
        </button>
        <div className="sd-modal-icon sd-pop">
          <PartyPopper />
        </div>
        <h2>{t('Tabriklaymiz, {name}!', { name })} 🎉</h2>
        <p>
          {t('Siz {label} mockini muvaffaqiyatli yechdingiz.', { label: '\u0000' }).split('\u0000').flatMap((part, i) => (i === 0 ? [part] : [<b key="l">{info.label}</b>, part]))}
        </p>
        <div className="sd-celebrate-score">
          <strong>{info.score}</strong>
          <small>/ {info.outOf}</small>
        </div>
        <p className="sd-celebrate-count">
          {total ? t("Mocklaringiz yana bittaga ko'paydi — jami {n} ta. Shunday davom eting!", { n: total }) : t("Mocklaringiz yana bittaga ko'paydi. Shunday davom eting!")}
        </p>
        <button className="sd-primary" onClick={() => setInfo(null)}>
          {t('Rahmat, davom etamiz')}
        </button>
      </div>
    </div>
  )
}
