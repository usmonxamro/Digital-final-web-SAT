'use client'

import { SatSkeleton } from '@/components/sat-loader'
import { GhostCards } from '@/components/marketing/dashboard/ghost-cards'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Calculator, CheckCircle2, Crown, Lock, PenLine, Play, Sparkles, Timer } from 'lucide-react'
import { useDashboardData, type TestSummary } from '@/components/marketing/dashboard/dashboard-data'
import { useUser } from '@/components/marketing/dashboard/user-context'
import { useSd } from '@/components/marketing/dashboard/sd-ui'
import { useT } from '@/components/i18n-provider'
import { inSection } from '@/lib/mock-sections'

type Filter = 'all' | 'math' | 'english' | 'full'

function isReady(t: TestSummary): boolean {
  if (t.subject === 'full') return t.readingCount >= 4 && t.mathCount >= 4
  if (t.subject === 'math') return t.mathCount >= 4
  return t.readingCount >= 4
}

const SUBJECT = {
  math: { label: 'Math', Icon: Calculator, c: '#ff6600', c2: '#f59e0b' },
  english: { label: 'Reading & Writing', Icon: PenLine, c: '#8b5cf6', c2: '#6366f1' },
  full: { label: 'Full SAT', Icon: Crown, c: '#f59e0b', c2: '#fb7185' },
} as const

export default function FreeMocksPage() {
  const t = useT()
  const { tests } = useDashboardData()
  const user = useUser()
  const { openModal } = useSd()
  const [filter, setFilter] = useState<Filter>('all')
  // Paid mocks open for Pro (incl. the free trial) and course students; admins count as course students.
  const unlocked = user.plan === 'premium' || user.courseMember !== false

  const mocks = useMemo(() => (tests ?? []).filter((t) => t.placement === 'mock' && inSection(t, 'free')), [tests])
  const shown = mocks.filter((t) => filter === 'all' || t.subject === filter)
  const paid = mocks.filter((t) => t.access === 'paid').length
  const free = mocks.length - paid

  return (
    <>
      <div className="sd-page-header">
        <div>
          <div className="sd-eyebrow">{t('SAT Akademiyasi / Testlar')}</div>
          <h1>{t('Bepul mocklar')}</h1>
        </div>
        <span className="sd-pill">{t('Mashq testlar')}</span>
      </div>

      <section className="sd-fm-hero">
        <div className="sd-fm-hero-copy">
          <span className="sd-fm-kicker">
            <Sparkles /> {t("O'qituvchi tuzgan testlar")}
          </span>
          <h2>{t('Mashq qiling. Qiyinroq savollar bilan sinang.')}</h2>
          <p>{t("Bu yerda imtihon versiyalari emas, o'zimiz tuzgan mashq mocklar bor. Kirib bemalol yeching va natijangizni kuzating.")}</p>
          <div className="sd-fm-stats">
            <span>
              <b>{mocks.length}</b> {t('ta mock')}
            </span>
            <span>
              <b>{free}</b> {t('ta bepul')}
            </span>
            {paid > 0 && (
              <span>
                <b>{paid}</b> {t('ta pullik')}
              </span>
            )}
          </div>
        </div>
        <div className="sd-fm-art" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>

      <div className="sd-filters">
        {(
          [
            ['all', 'Hammasi'],
            ['math', 'Math'],
            ['english', 'Reading & Writing'],
            ['full', 'Full SAT'],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button key={k} className={`sd-filter ${filter === k ? 'sd-selected' : ''}`} onClick={() => setFilter(k)}>
            {t(label)}
          </button>
        ))}
      </div>

      <div className="sd-fm-grid">
        {tests === null && <div style={{ gridColumn: '1 / -1' }}><SatSkeleton kind="cards" count={3} /></div>}
        {shown.map((x) => {
          const sub = SUBJECT[x.subject]
          const ready = isReady(x)
          const isPaid = x.access === 'paid'
          const locked = isPaid && !unlocked
          return (
            <article
              key={x.label}
              className={`sd-fm-card ${locked ? 'sd-fm-locked' : ''}`}
              style={{ ['--c' as string]: sub.c, ['--c2' as string]: sub.c2 }}
            >
              <div className="sd-fm-top">
                <span className="sd-fm-icon">
                  <sub.Icon />
                </span>
                {isPaid ? (
                  <span className="sd-fm-badge sd-paid">
                    <Lock /> {t('PULLIK')}
                  </span>
                ) : (
                  <span className="sd-fm-badge sd-free">{t('BEPUL')}</span>
                )}
              </div>
              <h3>{x.label}</h3>
              <div className="sd-fm-sub">{t(sub.label)}</div>
              <div className="sd-chips">
                {x.subject !== 'math' && (
                  <span className="sd-chip">
                    <PenLine /> {x.readingCount} R&amp;W
                  </span>
                )}
                {x.subject !== 'english' && (
                  <span className="sd-chip">
                    <Calculator /> {x.mathCount} Math
                  </span>
                )}
                {!x.scored && (
                  <span className="sd-chip">
                    <Timer /> {t('Erkin mashq')}
                  </span>
                )}
                {x.done && (
                  <span className="sd-chip sd-done">
                    <CheckCircle2 /> {t('Bajarilgan')}
                  </span>
                )}
              </div>
              {locked ? (
                <button className="sd-fm-btn sd-fm-btn-lock" onClick={() => openModal('paid')}>
                  <Lock /> {t('Ochish')}
                </button>
              ) : ready ? (
                <Link href={`/exam?test=${encodeURIComponent(x.label)}`} className="sd-fm-btn">
                  <Play /> {t('Boshlash')}
                </Link>
              ) : (
                <span className="sd-fm-btn sd-fm-btn-soon">
                  <Timer /> {t('Tez orada')}
                </span>
              )}
            </article>
          )
        })}
        {tests !== null && <GhostCards count={3} label={t('Yangi mock tayyorlanmoqda')} />}
      </div>
      {tests !== null && shown.length === 0 && (
        <div className="sd-panel sd-empty">
          {mocks.length === 0
            ? t("Hozircha Free Mocks yo'q — tez orada qo'shiladi.")
            : t('Bu turda hozircha mock yo‘q.')}
        </div>
      )}
    </>
  )
}
