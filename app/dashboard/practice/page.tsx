'use client'

import { SatSkeleton } from '@/components/sat-loader'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, BookOpen, Calculator, CheckCircle2, Crown, Lock, MonitorPlay, Play, Timer, ChevronLeft, PenLine } from 'lucide-react'
import { useDashboardData, type TestSummary } from '@/components/marketing/dashboard/dashboard-data'
import { groupExams, type ExamGroup } from '@/lib/exam-groups'
import { GhostCards } from '@/components/marketing/dashboard/ghost-cards'

type Quota = {
  usedToday: number
  perDay: number
  perHour: number
  allowed: boolean
  nextAllowedAt: string | null
  reason: 'day' | 'hour' | null
}

function QuotaBar({ quota }: { quota: Quota | null }) {
  if (!quota) return null
  const left = Math.max(0, quota.perDay - quota.usedToday)
  const at = quota.nextAllowedAt
    ? new Date(quota.nextAllowedAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' })
    : ''
  return (
    <div className="sd-quota">
      <b>
        <Timer /> Bugun: {quota.usedToday}/{quota.perDay} mock
      </b>
      <span className="sd-quota-dots">
        {Array.from({ length: quota.perDay }, (_, i) => (
          <i key={i} className={i < quota.usedToday ? 'sd-used' : ''} />
        ))}
      </span>
      <span>
        {quota.allowed
          ? `Yana ${left} ta yechishingiz mumkin · bir soatda ko'pi bilan ${quota.perHour} ta`
          : quota.reason === 'day'
            ? 'Kunlik limit tugadi — ertaga yana davom etasiz'
            : `Keyingi mock soat ${at} dan keyin ochiladi`}
      </span>
    </div>
  )
}

function isReady(t: TestSummary): boolean {
  if (t.subject === 'full') return t.readingCount >= 4 && t.mathCount >= 4
  if (t.subject === 'math') return t.mathCount >= 4
  return t.readingCount >= 4
}

function subjectLabel(t: TestSummary): string {
  if (t.subject === 'math') return 'Faqat Math'
  if (t.subject === 'english') return 'Faqat R&W'
  return 'Full SAT Mock'
}

export default function PracticePage() {
  const { tests } = useDashboardData()
  const [quota, setQuota] = useState<Quota | null>(null)
  const [unlimited, setUnlimited] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [year, setYear] = useState('all')

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    setQ((sp.get('q') ?? '').trim().toLowerCase())
    setOpen(sp.get('exam'))
    fetch('/api/exam/quota')
      .then((r) => r.json())
      .then((d) => {
        setQuota(d.quota ?? null)
        setUnlimited(!!d.unlimited)
      })
      .catch(() => {})
  }, [])

  const mocks = useMemo(() => (tests ?? []).filter((t) => t.placement === 'mock' && t.section !== 'free'), [tests])
  const groups = useMemo(() => groupExams(mocks), [mocks])
  const years = useMemo(() => [...new Set(groups.map((g) => g.year).filter(Boolean) as string[])].sort().reverse(), [groups])
  const visible = groups.filter(
    (g) =>
      (year === 'all' || g.year === year) &&
      (!q || g.name.toLowerCase().includes(q) || g.versions.some((v) => v.test.label.toLowerCase().includes(q))),
  )
  const current = open ? groups.find((g) => g.name.toLowerCase() === open.toLowerCase()) ?? null : null

  function show(name: string | null) {
    setOpen(name)
    const url = name ? `/dashboard/practice?exam=${encodeURIComponent(name)}` : '/dashboard/practice'
    window.history.replaceState(null, '', url)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      {current ? (
        <ExamDetail group={current} onBack={() => show(null)} />
      ) : (
        <>
          <div className="sd-page-header">
            <div>
              <div className="sd-eyebrow">SAT Akademiyasi / Testlar</div>
              <h1>All Past Exams</h1>
            </div>
            <span className="sd-pill">Imtihonlar arxivi</span>
          </div>
          <p className="sd-note">Imtihon nomini tanlang va ichidagi versiyalardan birini ishlang. Barqarorlik — muvaffaqiyat kaliti.</p>

          <Link href="/dashboard/free-mocks" className="sd-promo">
            <span className="sd-promo-icon">
              <Sparkles />
            </span>
            <span className="sd-promo-text">
              <strong>Tekin va qiyinroq mocklar ham bor!</strong>
              <small>Istasangiz Free Mocks bo&apos;limida o&apos;qituvchi tuzgan mashq testlarni bemalol yechishingiz mumkin.</small>
            </span>
            <span className="sd-promo-btn">
              Free Mocks&apos;ga o&apos;tish <ArrowRight />
            </span>
          </Link>

          {unlimited ? (
            <div className="sd-quota">
              <b>
                <Timer /> Admin: mocklar cheklovsiz
              </b>
            </div>
          ) : (
            <QuotaBar quota={quota} />
          )}

          {years.length > 0 && (
            <div className="sd-filters">
              {['all', ...years].map((y) => (
                <button key={y} className={`sd-filter ${year === y ? 'sd-selected' : ''}`} onClick={() => setYear(y)}>
                  {y === 'all' ? 'Barcha imtihonlar' : `${y} yil`}
                </button>
              ))}
              {q && (
                <span className="sd-chip">
                  Qidiruv: “{q}” <button className="sd-text-btn" onClick={() => { setQ(''); window.history.replaceState(null, '', '/dashboard/practice') }}>✕</button>
                </span>
              )}
            </div>
          )}

          <div className="sd-exam-grid">
            {tests === null && <div style={{ gridColumn: '1 / -1' }}><SatSkeleton kind="cards" count={3} /></div>}
            {visible.map((g) => (
              <ExamCard key={g.name} group={g} onOpen={() => show(g.name)} />
            ))}
            {tests !== null && visible.length === 0 && (
              <p className="sd-note" style={{ gridColumn: '1 / -1' }}>
                {mocks.length === 0 ? "Hozircha mocklar yo'q — tez orada qo'shiladi." : 'Hech narsa topilmadi.'}
              </p>
            )}
            {tests !== null && !q && year === 'all' && <GhostCards count={3} label="Yangi mock tayyorlanmoqda" />}
          </div>
        </>
      )}
    </div>
  )
}

function ExamCard({ group, onOpen }: { group: ExamGroup<TestSummary>; onOpen: () => void }) {
  const done = group.versions.filter((v) => v.test.done).length
  const hasFull = group.versions.some((v) => v.test.subject === 'full')
  const body = (
    <>
      <div className="sd-exam-icon">
        <BookOpen />
      </div>
      <h3>{group.name}</h3>
      <div className="sd-exam-tags">
        {hasFull && (
          <span className="sd-tag sd-full">
            <Crown /> TO&apos;LIQ
          </span>
        )}
        {done > 0 && (
          <span className="sd-tag sd-done">
            <CheckCircle2 /> {done}/{group.versions.length} bajarilgan
          </span>
        )}
      </div>
      <p>SAT Math va Reading &amp; Writing bo&apos;yicha imtihon variantlari.</p>
      <div className="sd-exam-foot">
        <span>{group.versions.length} ta versiya</span>
        <span>Ko&apos;rish →</span>
      </div>
    </>
  )
  return (
    <button className="sd-exam-card" onClick={onOpen}>
      {body}
    </button>
  )
}

function ExamDetail({ group, onBack }: { group: ExamGroup<TestSummary>; onBack: () => void }) {
  return (
    <>
      <button className="sd-back" onClick={onBack}>
        <ChevronLeft size={15} /> Barcha imtihonlar
      </button>
      <div className="sd-page-header">
        <div>
          <div className="sd-eyebrow">All Past Exams / {group.name}</div>
          <h1>{group.name}</h1>
        </div>
        <span className="sd-pill">{group.versions.length} ta versiya</span>
      </div>
      {group.versions.map(({ version, test: t }) => {
        const ready = isReady(t)
        return (
          <div key={t.label} className={`sd-detail-card ${ready ? '' : 'sd-soon'}`}>
            <div className="sd-version-badge">{version}</div>
            <div className="sd-detail-body">
              <strong>
                Version {version} · {subjectLabel(t)}
              </strong>
              <div className="sd-chips">
                {t.subject !== 'math' && (
                  <span className="sd-chip">
                    <PenLine /> {t.readingCount} R&amp;W savol
                  </span>
                )}
                {t.subject !== 'english' && (
                  <span className="sd-chip">
                    <Calculator /> {t.mathCount} Math savol
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
                {t.hasVideo && (
                  <span className="sd-chip">
                    <MonitorPlay /> Video tahlil
                  </span>
                )}
              </div>
            </div>
            <div className="sd-detail-actions">
              {ready ? (
                <Link href={`/exam?test=${encodeURIComponent(t.label)}`} className="sd-primary">
                  <Play /> Boshlash
                </Link>
              ) : (
                <span className="sd-soft sd-lock-btn">
                  <Lock /> Tez orada
                </span>
              )}
              {t.hasVideo && t.done && (
                <Link href={`/dashboard/analysis?test=${encodeURIComponent(t.label)}`} className="sd-soft">
                  <MonitorPlay /> Video tahlil
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
