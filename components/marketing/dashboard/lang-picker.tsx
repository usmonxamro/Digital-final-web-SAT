'use client'

import { useEffect, useRef, useState } from 'react'
import { Gift } from 'lucide-react'
import { LANGS, LANG_SET_COOKIE, type Lang } from '@/lib/i18n'
import { useI18n } from '@/components/i18n-provider'
import { useUser } from '@/components/marketing/dashboard/user-context'

const FLAGS: Record<Lang, string> = { uz: '🇺🇿', ru: '🇷🇺', en: '🇬🇧' }
const TITLE: Record<Lang, string> = { uz: 'Tilni tanlang', ru: 'Выберите язык', en: 'Choose your language' }
const SUB: Record<Lang, string> = {
  uz: 'Saytni o‘zingizga qulay tilda ishlating',
  ru: 'Пользуйтесь сайтом на удобном языке',
  en: 'Use the site in the language you prefer',
}

/**
 * First-login pop-up: centred card with 3 language bars. The orange highlight slides to the chosen
 * language and the site switches immediately; Uzbek is selected by default.
 * Afterwards (once) a "1 month Pro for free" welcome is shown to users on the launch trial.
 */
export function LangPicker() {
  const { lang, setLang, t } = useI18n()
  const user = useUser()
  const [step, setStep] = useState<'none' | 'lang' | 'trial'>('none')
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const langSet = document.cookie.split('; ').some((c) => c.startsWith(`${LANG_SET_COOKIE}=`))
    if (!langSet) return setStep('lang')
    maybeTrial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function maybeTrial() {
    if (!user.trialDaysLeft || user.trialDaysLeft <= 0) return setStep('none')
    try {
      if (localStorage.getItem('sp-trial-welcome') === '1') return setStep('none')
    } catch {}
    setStep('trial')
  }

  function pick(l: Lang) {
    setLang(l)
    if (closing.current) clearTimeout(closing.current)
    closing.current = setTimeout(maybeTrial, 950)
  }

  function closeTrial() {
    try {
      localStorage.setItem('sp-trial-welcome', '1')
    } catch {}
    setStep('none')
  }

  if (step === 'none') return null
  const idx = Math.max(0, LANGS.findIndex((l) => l.code === lang))

  if (step === 'trial') {
    return (
      <div className="sd-lp-backdrop">
        <div className="sd-lp-card sd-lp-trial" role="dialog" aria-modal="true">
          <div className="sd-lp-glow" />
          <div className="sd-lp-gift">
            <Gift />
          </div>
          <h2>{t('Siz PRO obunani bir oyga tekinga qabul qilib oldingiz! 🎉')}</h2>
          <p>{t('Ishga tushirish aksiyasi: {n} kun davomida kuniga 4 tagacha mock yechishingiz mumkin.', { n: user.trialDaysLeft ?? 30 })}</p>
          <button className="sd-primary" onClick={closeTrial}>
            {t('Ajoyib, boshlaymiz')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="sd-lp-backdrop">
      <div className="sd-lp-card" role="dialog" aria-modal="true" aria-label={TITLE[lang]}>
        <div className="sd-lp-glow" />
        <div className="sd-lp-globe">🌐</div>
        <h2 key={lang}>{TITLE[lang]}</h2>
        <p key={lang + 's'}>{SUB[lang]}</p>
        <div className="sd-lp-bars">
          <i style={{ transform: `translateY(${idx * 100}%)` }} />
          {LANGS.map((l, n) => (
            <button key={l.code} type="button" className={l.code === lang ? 'on' : ''} style={{ animationDelay: `${0.15 + n * 0.09}s` }} onClick={() => pick(l.code)}>
              <span className="sd-lp-flag">{FLAGS[l.code]}</span>
              <span className="sd-lp-name">{l.native}</span>
              <span className="sd-lp-dot" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
