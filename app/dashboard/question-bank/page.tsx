'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Crosshair, Layers, Target } from 'lucide-react'
import { SatSkeleton } from '@/components/sat-loader'
import { useI18n } from '@/components/i18n-provider'
import { BANK_SECTIONS } from '@/lib/bank-meta'
import { Ring } from '@/components/marketing/dashboard/ring'
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
  const correct = sections?.reduce((s, x) => s + x.correct, 0) ?? 0
  const topics = sections?.reduce((s, x) => s + x.topics.length, 0) ?? 0

  return (
    <>
      <div className="sd-page-header">
        <div>
          <div className="sd-eyebrow">{t('SAT Akademiyasi / Mashq')}</div>
          <h1>{t('Savollar banki')}</h1>
        </div>
      </div>

      {sections === null && <SatSkeleton kind="cards" count={4} />}
      {sections && total === 0 && <div className="sd-panel sd-empty">{t('Savollar banki tez orada ochiladi.')}</div>}

      {sections && total > 0 && (
        <section className="sd-qbx-hero">
          <Ring value={total ? (answered / total) * 100 : 0} size={96} stroke={9} />
          <div className="sd-qbx-hero-text">
            <h2>{t('Sizning progressingiz')}</h2>
            <p>{t("Bo'limni tanlang, mavzu va qiyinlik bo'yicha mashq qiling. Har javobdan so'ng to'g'ri javob va yechimni darhol ko'rasiz; ko'rmagan va xato qilgan savollaringiz birinchi beriladi.")}</p>
            <div className="sd-xd-stats">
              <span>
                <CheckCircle2 /> <b>{answered}</b>/{total} {t('yechilgan')}
              </span>
              <span>
                <Crosshair /> {t('Aniqlik')} <b>{answered ? Math.round((correct / answered) * 100) : 0}%</b>
              </span>
              <span>
                <Layers /> <b>{topics}</b> {t('mavzu')}
              </span>
            </div>
          </div>
        </section>
      )}

      <div className="sd-qbx-sections">
        {sections?.map((s) => {
          const meta = BANK_SECTIONS.find((m) => m.key === s.key)!
          if (s.total === 0) return null
          const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : 0
          const prog = s.total ? (s.answered / s.total) * 100 : 0
          return (
            <Link key={s.key} href={`/dashboard/question-bank/${s.key}`} className="sd-qbx-sec" style={{ ['--h' as string]: meta.hue }}>
              <span className="sd-qbx-sec-top">
                <span className="sd-qbx-sec-ico">
                  <Target />
                </span>
                <span className="sd-qbx-sec-name">
                  <b>{meta.names[lang]}</b>
                  <small>
                    {t('{n} ta savol', { n: s.total })} · {t('{n} ta mavzu', { n: s.topics.length })}
                  </small>
                </span>
                <Ring value={prog} size={52} stroke={6} color="hsl(var(--h) 80% 50%)" />
              </span>
              <span className="sd-qbx-sec-bar">
                <i style={{ width: `${prog}%` }} />
              </span>
              <span className="sd-qbx-sec-foot">
                <span>{s.answered ? t('{a} / {b} yechilgan', { a: s.answered, b: s.total }) : t('Hali boshlanmagan')}</span>
                {s.answered > 0 && <span className="sd-qbx-acc">{t('Aniqlik {p}%', { p: pct })}</span>}
                <b>
                  {s.answered ? t('Davom ettirish') : t('Boshlash')} <ArrowRight />
                </b>
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
