'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import './lp.css'
import { useI18n } from '@/components/i18n-provider'
import { LP_BODY } from '@/components/marketing/landing/lp-body'
import { LP_BOOKS } from '@/components/marketing/landing/lp-books'
import { LP_DARAJA } from '@/components/marketing/landing/lp-daraja'
import { translateHtml } from '@/components/marketing/landing/lp-i18n'
import { startLpEffects } from '@/components/marketing/landing/lp-effects'
import { LpHeader } from '@/components/marketing/landing/lp-header'
import { COURSE_CARDS_MARK, courseCardHtml, splitCourseCards } from '@/components/marketing/landing/lp-courses'
import { DEFAULT_COURSE_GROUPS, type CourseGroup } from '@/lib/course-groups'
import { useCourseGroups } from '@/components/use-course-groups'

/** The books section sits between the features and the Telegram courses. */
const COURSES_MARK = '<!-- SCREEN 3: COURSES -->'
const FULL = LP_BODY.includes(COURSES_MARK) ? LP_BODY.replace(COURSES_MARK, LP_DARAJA + '\n' + LP_BOOKS + '\n' + COURSES_MARK) : LP_BODY + LP_DARAJA + LP_BOOKS
/** Course cards come from Admin → «Kurs bannerlari»; the static ones are only colour templates. */
const { body: BODY_SPLIT, templates: CARD_TPL } = splitCourseCards(FULL)
const cardsFor = (groups: CourseGroup[]) =>
  groups
    .filter((g) => g.landing && !g.archived)
    .map((g) => courseCardHtml(g, CARD_TPL))
    .join('\n')
const DEFAULT_CARDS = cardsFor(DEFAULT_COURSE_GROUPS)
const BODY = BODY_SPLIT.replace(COURSE_CARDS_MARK, DEFAULT_CARDS)

/** The landing page: static, pre-translated markup + a small effects layer (demo, FAQ, reveal). */
function LandingImpl() {
  const { lang } = useI18n()
  const html = useMemo(() => translateHtml(BODY, lang), [lang])
  const ref = useRef<HTMLDivElement>(null)
  const groups = useCourseGroups()
  const cards = useMemo(() => (groups ? cardsFor(groups) : DEFAULT_CARDS), [groups])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    return startLpEffects(el, lang)
  }, [lang])

  // The admin's current banners (only touches the course grid, so the demo / effects keep running).
  useEffect(() => {
    const grid = ref.current?.querySelector<HTMLElement>('.c-grid')
    if (!grid) return
    if (cards !== DEFAULT_CARDS) grid.innerHTML = translateHtml(cards, lang)
    const n = grid.querySelectorAll('.c-card').length
    grid.classList.toggle('c-one', n === 1)
    const section = grid.closest<HTMLElement>('.courses')
    grid.style.display = n === 0 ? 'none' : ''
    if (section) section.dataset.cards = String(n)
  }, [cards, lang])

  return (
    <div className="lp">
      <LpHeader />
      {/* key: a language switch swaps the markup, so the demo/effects are restarted on the fresh DOM */}
      <div key={lang} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

export const Landing = memo(LandingImpl)
