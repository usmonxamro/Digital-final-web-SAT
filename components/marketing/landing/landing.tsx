'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import './lp.css'
import { useI18n } from '@/components/i18n-provider'
import { LP_BODY } from '@/components/marketing/landing/lp-body'
import { LP_BOOKS } from '@/components/marketing/landing/lp-books'
import { translateHtml } from '@/components/marketing/landing/lp-i18n'
import { startLpEffects } from '@/components/marketing/landing/lp-effects'
import { LpHeader } from '@/components/marketing/landing/lp-header'

/** The books section sits between the features and the Telegram courses. */
const COURSES_MARK = '<!-- SCREEN 3: COURSES -->'
const BODY = LP_BODY.includes(COURSES_MARK) ? LP_BODY.replace(COURSES_MARK, LP_BOOKS + '\n' + COURSES_MARK) : LP_BODY + LP_BOOKS

/** The landing page: static, pre-translated markup + a small effects layer (demo, FAQ, reveal). */
function LandingImpl() {
  const { lang } = useI18n()
  const html = useMemo(() => translateHtml(BODY, lang), [lang])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    return startLpEffects(el, lang)
  }, [lang])

  return (
    <div className="lp">
      <LpHeader />
      {/* key: a language switch swaps the markup, so the demo/effects are restarted on the fresh DOM */}
      <div key={lang} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

export const Landing = memo(LandingImpl)
