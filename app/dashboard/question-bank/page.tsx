'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Layers, Target } from 'lucide-react'
import { SatSkeleton } from '@/components/sat-loader'
import { useI18n } from '@/components/i18n-provider'
import { BANK_SECTIONS } from '@/lib/bank-meta'
import type { BankSectionStat } from '@/app/api/bank/overview/route'

/** "Questions bank": the four sections of the book with the student's progress; each opens its topics + practice. */
export default function QuestionBankPage() {
  const { t, lang } = useI18n()
  const [sections, setSections] = useState<BankSectionStat[] | null>(null)

  useEffect(() => {
    fetch('/api/bank/overview')
      .then((r) => r.json())
      .then((d) => setSections(d.sections ?? []))
      .catch(() => setSections([]))
  }, [])

  const total = sections?.reduce((s, x) => s + x.total, 0) ?? 0
  const answered = sections?.reduce((s, x) => s + x.answered, 0) ?? 0

  return (
    <>
      <div className="sd-page-header">
        <div>
          <div className="sd-eyebrow">{t('SAT Akademiyasi / Mashq')}</div>
          <h1>{t('Savollar banki')}</h1>
        </div>
        {sections && total > 0 && (
          <span className="sd-pill">
            {t('{a} / {b} savol yechilgan', { a: answered, b: total })}
          </span>
        )}
      </div>
      <p className="sd-note">{t("Bo'limni tanlang, mavzu va qiyinlik bo'yicha mashq qiling. Har javobdan so'ng to'g'ri javob va yechimni darhol ko'rasiz; ko'rmagan va xato qilgan savollaringiz birinchi beriladi.")}</p>

      {sections === null && <SatSkeleton kind="cards" count={4} />}
      {sections && total === 0 && <div className="sd-panel sd-empty">{t("Savollar banki tez orada ochiladi.")}</div>}

      <div className="sd-qb-sections">
        {sections?.map((s) => {
          const meta = BANK_SECTIONS.find((m) => m.key === s.key)!
          if (s.total === 0) return null
          const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : 0
          return (
            <Link key={s.key} href={`/dashboard/question-bank/${s.key}`} className="sd-mo-card" style={{ ['--h' as string]: meta.hue }}>
              <span className="sd-mo-banner">
                <span className="sd-mo-year">{t('{n} ta savol', { n: s.total })}</span>
                <span className="sd-mo-title" style={{ fontSize: 22 }}>
                  {meta.names[lang]}
                </span>
                <span className="sd-mo-rest">{t('{n} ta mavzu', { n: s.topics.length })}</span>
              </span>
              <span className="sd-mo-body">
                <span className="sd-mo-line">
                  <Layers /> {t('{a} / {b} yechilgan', { a: s.answered, b: s.total })}
                </span>
                <span className="sd-qb-bar-mini">
                  <i style={{ width: `${s.total ? (s.answered / s.total) * 100 : 0}%` }} />
                </span>
                <span className="sd-mo-foot">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Target size={13} /> {s.answered ? t('Aniqlik {p}%', { p: pct }) : t('Hali boshlanmagan')}
                  </span>
                  <b>
                    {t('Mavzular')} <ArrowRight />
                  </b>
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
