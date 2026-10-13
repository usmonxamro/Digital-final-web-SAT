'use client'

import { GhostCards } from '@/components/marketing/dashboard/ghost-cards'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Calculator, CheckCircle2, Crown, Lock, PenLine, Play, Sparkles, Timer } from 'lucide-react'
import { useDashboardData, type TestSummary } from '@/components/marketing/dashboard/dashboard-data'
import { useUser } from '@/components/marketing/dashboard/user-context'
import { useSd } from '@/components/marketing/dashboard/sd-ui'

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
  const { tests } = useDashboardData()
  const user = useUser()
  const { openModal } = useSd()
  const [filter, setFilter] = useState<Filter>('all')
  // Paid mocks open for Pro (incl. the free trial) and course students; admins count as course students.
  const unlocked = user.plan === 'premium' || user.courseMember !== false

  const mocks = useMemo(() => (tests ?? []).filter((t) => t.placement === 'mock' && t.section === 'free'), [tests])
  const shown = mocks.filter((t) => filter === 'all' || t.subject === filter)
  const paid = mocks.filter((t) => t.access === 'paid').length
  const free = mocks.length - paid

  return (
    <>
      <div className="sd-page-header">
        <div>
          <div className="sd-eyebrow">SAT Akademiyasi / Testlar</div>
          <h1>Free Mocks</h1>
        </div>
        <span className="sd-pill">Mashq testlar</span>
      </div>

      <section className="sd-fm-hero">
        <div className="sd-fm-hero-copy">
          <span className="sd-fm-kicker">
            <Sparkles /> O&apos;qituvchi tuzgan testlar
          </span>
          <h2>Mashq qiling. Qiyinroq savollar bilan sinang.</h2>
          <p>Bu yerda imtihon versiyalari emas, o&apos;zimiz tuzgan mashq mocklar bor. Kirib bemalol yeching va natijangizni kuzating.</p>
          <div className="sd-fm-stats">
            <span>
              <b>{mocks.length}</b> ta mock
            </span>
            <span>
              <b>{free}</b> ta bepul
            </span>
            {paid > 0 && (
              <span>
                <b>{paid}</b> ta pullik
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
            {label}
          </button>
        ))}
      </div>

      <div className="sd-fm-grid">
        {tests === null && <div className="sd-panel sd-empty">Yuklanmoqda...</div>}
        {shown.map((t) => {
          const sub = SUBJECT[t.subject]
          const ready = isReady(t)
          const isPaid = t.access === 'paid'
          const locked = isPaid && !unlocked
          return (
            <article
              key={t.label}
              className={`sd-fm-card ${locked ? 'sd-fm-locked' : ''}`}
              style={{ ['--c' as string]: sub.c, ['--c2' as string]: sub.c2 }}
            >
              <div className="sd-fm-top">
                <span className="sd-fm-icon">
                  <sub.Icon />
                </span>
                {isPaid ? (
                  <span className="sd-fm-badge sd-paid">
                    <Lock /> PULLIK
                  </span>
                ) : (
                  <span className="sd-fm-badge sd-free">BEPUL</span>
                )}
              </div>
              <h3>{t.label}</h3>
              <div className="sd-fm-sub">{sub.label}</div>
              <div className="sd-chips">
                {t.subject !== 'math' && (
                  <span className="sd-chip">
                    <PenLine /> {t.readingCount} R&amp;W
                  </span>
                )}
                {t.subject !== 'english' && (
                  <span className="sd-chip">
                    <Calculator /> {t.mathCount} Math
                  </span>
                )}
                {!t.scored && (
                  <span className="sd-chip">
                    <Timer /> Erkin mashq
                  </span>
                )}
                {t.done && (
                  <span className="sd-chip sd-done">
                    <CheckCircle2 /> Bajarilgan
                  </span>
                )}
              </div>
              {locked ? (
                <button className="sd-fm-btn sd-fm-btn-lock" onClick={() => openModal('paid')}>
                  <Lock /> Ochish
                </button>
              ) : ready ? (
                <Link href={`/exam?test=${encodeURIComponent(t.label)}`} className="sd-fm-btn">
                  <Play /> Boshlash
                </Link>
              ) : (
                <span className="sd-fm-btn sd-fm-btn-soon">
                  <Timer /> Tez orada
                </span>
              )}
            </article>
          )
        })}
        {tests !== null && <GhostCards count={3} label="Yangi mock tayyorlanmoqda" />}
      </div>
      {tests !== null && shown.length === 0 && (
        <div className="sd-panel sd-empty">
          {mocks.length === 0
            ? "Hozircha Free Mocks yo'q — tez orada qo'shiladi."
            : 'Bu turda hozircha mock yo‘q.'}
        </div>
      )}
    </>
  )
}
