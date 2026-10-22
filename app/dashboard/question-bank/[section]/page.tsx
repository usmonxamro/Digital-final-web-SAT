'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronLeft, Crosshair, Layers, Play, Shuffle } from 'lucide-react'
import { SatSkeleton } from '@/components/sat-loader'
import { BankSession } from '@/components/bank-session'
import { useI18n } from '@/components/i18n-provider'
import { sectionByKey, topicName } from '@/lib/bank-meta'
import { Ring } from '@/components/marketing/dashboard/ring'
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
    const topicTitle = session.topic && stat ? topicName(session.topic, stat.topics.find((x) => x.code === session.topic)?.topic ?? '', lang) : t('Aralash mashq')
    return (
      <div className="sd-qbx" style={hue}>
        <BankSession
          title={topicTitle}
          crumb={meta.names[lang]}
          params={{ section: key, topic: session.topic, difficulty: diff || undefined, n }}
          onExit={() => {
            setSession(null)
            load()
          }}
        />
      </div>
    )
  }

  const prog = stat && stat.total ? (stat.answered / stat.total) * 100 : 0
  const acc = stat && stat.answered ? Math.round((stat.correct / stat.answered) * 100) : 0

  return (
    <div className="sd-qbx" style={hue}>
      <Link href="/dashboard/question-bank" className="sd-back">
        <ChevronLeft size={15} /> {t('Savollar banki')}
      </Link>

      <section className="sd-qbx-shero">
        <div className="sd-qbx-shero-text">
          <div className="sd-xd-kicker">{t('Savollar banki')}</div>
          <h1>{meta.names[lang]}</h1>
          {stat && (
            <div className="sd-xd-stats">
              <span>
                <CheckCircle2 /> <b>{stat.answered}</b>/{stat.total} {t('yechilgan')}
              </span>
              <span>
                <Crosshair /> {t('Aniqlik')} <b>{acc}%</b>
              </span>
              <span>
                <Layers /> <b>{stat.topics.length}</b> {t('mavzu')}
              </span>
            </div>
          )}
        </div>
        {stat && <Ring value={prog} size={92} stroke={9} color="#fff" />}
      </section>

      <div className="sd-qbx-controls">
        <div className="sd-qbx-seg" role="group" aria-label={t('Qiyinlik')}>
          {DIFFS.map((d) => (
            <button key={d || 'all'} className={diff === d ? 'sd-on' : ''} onClick={() => setDiff(d)}>
              {d === '' ? t('Hammasi') : d}
            </button>
          ))}
        </div>
        <div className="sd-qbx-seg" role="group" aria-label={t('Savollar soni')}>
          {[10, 20].map((v) => (
            <button key={v} className={n === v ? 'sd-on' : ''} onClick={() => setN(v)}>
              {t('{n} ta savol', { n: v })}
            </button>
          ))}
        </div>
      </div>

      {stat === undefined && <SatSkeleton kind="list" count={4} />}
      {stat === null && <div className="sd-panel sd-empty">{t("Ma'lumotni yuklab bo'lmadi.")}</div>}
      {stat && (
        <>
          <button className="sd-qbx-mix" onClick={() => setSession({})}>
            <span className="sd-qbx-mix-ico">
              <Shuffle />
            </span>
            <span className="sd-qbx-mix-text">
              <b>{t('Barcha mavzulardan aralash mashq')}</b>
              <small>{t("Ko'rmagan va xato qilgan savollaringiz birinchi beriladi")}</small>
            </span>
            <span className="sd-qbx-mix-go">
              <Play />
            </span>
          </button>

          <h3 className="sd-qbx-h3">{t('Mavzular')}</h3>
          <div className="sd-qbx-topics">
            {stat.topics.map((tp) => {
              const pct = tp.answered ? Math.round((tp.correct / tp.answered) * 100) : 0
              const p = tp.total ? (tp.answered / tp.total) * 100 : 0
              const state = tp.answered === 0 ? 'new' : tp.answered >= tp.total ? 'done' : 'go'
              return (
                <button key={tp.code} className={`sd-qbx-topic sd-${state}`} onClick={() => setSession({ topic: tp.code })}>
                  <span className="sd-qbx-topic-main">
                    <b>{topicName(tp.code, tp.topic, lang)}</b>
                    <span className="sd-qbx-topic-meta">
                      <span>{t('{a} / {b} yechilgan', { a: tp.answered, b: tp.total })}</span>
                      {tp.answered > 0 && <span className={`sd-qbx-acc ${pct >= 75 ? 'sd-g' : pct >= 50 ? 'sd-y' : 'sd-r'}`}>{pct}%</span>}
                    </span>
                    <span className="sd-qbx-sec-bar">
                      <i style={{ width: `${p}%` }} />
                    </span>
                  </span>
                  <span className="sd-qbx-topic-go">
                    {state === 'done' ? <CheckCircle2 /> : <Play />}
                    <em>{state === 'new' ? t('Boshlash') : state === 'done' ? t('Takrorlash') : t('Davom')}</em>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
