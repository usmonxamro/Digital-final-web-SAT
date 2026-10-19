'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Play, Shuffle } from 'lucide-react'
import { SatSkeleton } from '@/components/sat-loader'
import { BankSession } from '@/components/bank-session'
import { useI18n } from '@/components/i18n-provider'
import { sectionByKey, topicName } from '@/lib/bank-meta'
import type { BankSectionStat } from '@/app/api/bank/overview/route'

const DIFFS = ['', 'Easy', 'Medium', 'Hard'] as const

/** One section: its topics with progress, difficulty + set-size choice, and the practice itself. */
export default function BankSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: key } = use(params)
  const { t, lang } = useI18n()
  const meta = sectionByKey(key)
  const [stat, setStat] = useState<BankSectionStat | null | undefined>(undefined)
  const [diff, setDiff] = useState<(typeof DIFFS)[number]>('')
  const [n, setN] = useState(10)
  const [session, setSession] = useState<{ topic?: string } | null>(null)

  const load = () =>
    fetch('/api/bank/overview')
      .then((r) => r.json())
      .then((d) => setStat((d.sections as BankSectionStat[] | undefined)?.find((s) => s.key === key) ?? null))
      .catch(() => setStat(null))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!meta) {
    return (
      <div className="sd-panel sd-empty">
        {t("Bo'lim topilmadi.")} <Link href="/dashboard/question-bank">{t('Savollar banki')}</Link>
      </div>
    )
  }
  const hue = { ['--h' as string]: meta.hue } as React.CSSProperties

  if (session) {
    return (
      <>
        <div className="sd-mo-hero" style={hue}>
          <div>
            <div className="sd-eyebrow">
              {t('Savollar banki')} / {meta.names[lang]}
            </div>
            <h1 style={{ fontSize: 24 }}>{session.topic && stat ? topicName(session.topic, stat.topics.find((x) => x.code === session.topic)?.topic ?? '', lang) : t('Aralash mashq')}</h1>
          </div>
        </div>
        <BankSession
          params={{ section: key, topic: session.topic, difficulty: diff || undefined, n }}
          onExit={() => {
            setSession(null)
            load()
          }}
        />
      </>
    )
  }

  return (
    <>
      <Link href="/dashboard/question-bank" className="sd-back">
        <ChevronLeft size={15} /> {t('Savollar banki')}
      </Link>
      <div className="sd-mo-hero" style={hue}>
        <div>
          <div className="sd-eyebrow">{t('Savollar banki')}</div>
          <h1>{meta.names[lang]}</h1>
        </div>
        {stat && <span className="sd-pill">{t('{n} ta savol', { n: stat.total })}</span>}
      </div>

      <div className="sd-filters">
        {DIFFS.map((d) => (
          <button key={d || 'all'} className={`sd-filter ${diff === d ? 'sd-selected' : ''}`} onClick={() => setDiff(d)}>
            {d === '' ? t('Barcha qiyinliklar') : d}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {[10, 20].map((v) => (
          <button key={v} className={`sd-filter ${n === v ? 'sd-selected' : ''}`} onClick={() => setN(v)}>
            {t('{n} ta savol', { n: v })}
          </button>
        ))}
      </div>

      {stat === undefined && <SatSkeleton kind="list" count={4} />}
      {stat === null && <div className="sd-panel sd-empty">{t("Ma'lumotni yuklab bo'lmadi.")}</div>}
      {stat && (
        <>
          <button className="sd-qb-mix" style={hue} onClick={() => setSession({})}>
            <Shuffle /> <span>{t('Barcha mavzulardan aralash mashq')}</span> <Play />
          </button>
          <div className="sd-qb-topics">
            {stat.topics.map((tp) => {
              const pct = tp.answered ? Math.round((tp.correct / tp.answered) * 100) : 0
              return (
                <button key={tp.code} className="sd-qb-topic-row" style={hue} onClick={() => setSession({ topic: tp.code })}>
                  <span className="sd-qb-topic-main">
                    <b>{topicName(tp.code, tp.topic, lang)}</b>
                    <small>
                      {t('{a} / {b} yechilgan', { a: tp.answered, b: tp.total })}
                      {tp.answered > 0 ? ` · ${t('Aniqlik {p}%', { p: pct })}` : ''}
                    </small>
                    <span className="sd-qb-bar-mini">
                      <i style={{ width: `${tp.total ? (tp.answered / tp.total) * 100 : 0}%` }} />
                    </span>
                  </span>
                  <span className="sd-qb-go">
                    <Play />
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
