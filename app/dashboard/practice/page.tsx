'use client'

import { SatSkeleton } from '@/components/sat-loader'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Search, Sparkles, Calculator, CheckCircle2, Clock, Globe2, Lock, MonitorPlay, Play, RotateCcw, Timer, ChevronLeft, PenLine, Layers } from 'lucide-react'
import { useDashboardData, type TestSummary } from '@/components/marketing/dashboard/dashboard-data'
import { groupExams, parseExamName, splitExamLabel, type ExamGroup } from '@/lib/exam-groups'
import { GhostCards } from '@/components/marketing/dashboard/ghost-cards'
import { inSection } from '@/lib/mock-sections'
import { useI18n } from '@/components/i18n-provider'
import type { Lang } from '@/lib/i18n'

type Quota = {
  usedToday: number
  perDay: number
  perHour: number
  allowed: boolean
  nextAllowedAt: string | null
  reason: 'day' | 'hour' | null
}

const LOCALE: Record<Lang, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' }

function QuotaBar({ quota }: { quota: Quota | null }) {
  const { t, lang } = useI18n()
  if (!quota) return null
  const left = Math.max(0, quota.perDay - quota.usedToday)
  const at = quota.nextAllowedAt
    ? new Date(quota.nextAllowedAt).toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' })
    : ''
  return (
    <div className="sd-quota">
      <b>
        <Timer /> {t('Bugun: {x} mock', { x: `${quota.usedToday}/${quota.perDay}` })}
      </b>
      <span className="sd-quota-dots">
        {Array.from({ length: quota.perDay }, (_, i) => (
          <i key={i} className={i < quota.usedToday ? 'sd-used' : ''} />
        ))}
      </span>
      <span>
        {quota.allowed
          ? t("Yana {n} ta yechishingiz mumkin · bir soatda ko'pi bilan {m} ta", { n: left, m: quota.perHour })
          : quota.reason === 'day'
            ? t('Kunlik limit tugadi — ertaga yana davom etasiz')
            : t('Keyingi mock soat {at} dan keyin ochiladi', { at })}
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

/* ------------------------- month / year helpers ------------------------- */

const MONTH_NAMES: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
}

/** The exam's month / year / rest of the name (the group name is already normalised: "SAT March 2025"). */
function parseExam(name: string) {
  const p = parseExamName(name)
  return { month: p.month, year: p.year, rest: p.rest }
}

/** Banner colour: one hue per month, so a year reads like a colourful calendar. */
const hueOf = (month: number, name: string) => (month >= 0 ? (month * 30 + 18) % 360 : (name.length * 47) % 360)

function bannerStyle(month: number, name: string): React.CSSProperties {
  return { ['--h' as string]: hueOf(month, name) }
}

/* --------------------------------- page --------------------------------- */

export default function PracticePage() {
  const { t, lang } = useI18n()
  const { tests } = useDashboardData()
  const [quota, setQuota] = useState<Quota | null>(null)
  const [unlimited, setUnlimited] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [year, setYear] = useState('all')
  const [kind, setKind] = useState<'all' | 'full' | 'math' | 'english'>('all')
  const [sort, setSort] = useState<'new' | 'old'>('new')

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

  const mocks = useMemo(() => (tests ?? []).filter((x) => x.placement === 'mock' && inSection(x, 'exams')), [tests])
  const groups = useMemo(() => groupExams(mocks), [mocks])
  const years = useMemo(() => [...new Set(groups.map((g) => g.year).filter(Boolean) as string[])].sort().reverse(), [groups])
  const visible = groups.filter(
    (g) =>
      (year === 'all' || g.year === year) &&
      (kind === 'all' || g.versions.some((v) => v.test.subject === kind)) &&
      (!q || g.name.toLowerCase().includes(q) || g.versions.some((v) => v.test.label.toLowerCase().includes(q))),
  )
  // Sections: one per year (newest first), then everything without a year.
  const sections = useMemo(() => {
    const by = new Map<string, ExamGroup<TestSummary>[]>()
    for (const g of visible) {
      const k = g.year ?? ''
      by.set(k, [...(by.get(k) ?? []), g])
    }
    for (const [k, list] of by) by.set(k, [...list].sort((x, y) => parseExam(x.name).month - parseExam(y.name).month))
    const dir = sort === 'new' ? 1 : -1
    return [...by.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : dir * b[0].localeCompare(a[0])))
  }, [visible, sort])
  const totalVersions = useMemo(() => groups.reduce((n, g) => n + g.versions.length, 0), [groups])
  // Old links named the exam differently ("SAT March 2025 US"): fall back to the group that holds such a mock.
  const current = open
    ? groups.find((g) => g.name.toLowerCase() === open.toLowerCase()) ??
      groups.find((g) => g.versions.some((v) => splitExamLabel(v.test.label).group.toLowerCase() === open.toLowerCase())) ??
      null
    : null

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
          <div className="sd-ex-hero">
            <Cover srcs={['/covers/hero.webp']}>
              <HeroArt />
            </Cover>
            <div className="sd-ex-hero-fade" />
            <div className="sd-ex-hero-text">
              <h1>
                {t("Barcha o'tgan SAT imtihonlari")
                  .split('SAT')
                  .flatMap((part, i, arr) => (i < arr.length - 1 ? [part, <span key={i}>SAT</span>] : [part]))}
              </h1>
              <p>{t("Barcha rasmiy SAT imtihonlari bir joyda. Mockni tanlab, hoziroq yechishni boshlang.")}</p>
            </div>
            <div className="sd-ex-stats">
              <div>
                <Layers />
                <b>{groups.length || '—'}</b>
                <small>{t('Barcha imtihonlar')}</small>
              </div>
              <div>
                <PenLine />
                <b>{totalVersions ? `${totalVersions}` : '—'}</b>
                <small>{t('Test variantlari')}</small>
              </div>
              <div>
                <Calculator />
                <b>{t('Cheksiz')}</b>
                <small>{t('Amaliyot')}</small>
              </div>
            </div>
          </div>

          <Link href="/dashboard/free-mocks" className="sd-promo">
            <span className="sd-promo-icon">
              <Sparkles />
            </span>
            <span className="sd-promo-text">
              <strong>{t('Tekin va qiyinroq mocklar ham bor!')}</strong>
              <small>{t("Istasangiz Bepul mocklar bo'limida o'qituvchi tuzgan mashq testlarni bemalol yechishingiz mumkin.")}</small>
            </span>
            <span className="sd-promo-btn">
              {t("Bepul mocklarga o'tish")} <ArrowRight />
            </span>
          </Link>

          {unlimited ? (
            <div className="sd-quota">
              <b>
                <Timer /> {t('Admin: mocklar cheklovsiz')}
              </b>
            </div>
          ) : (
            <QuotaBar quota={quota} />
          )}

          <div className="sd-ex-bar">
            <div className="sd-ex-years">
              {['all', ...years.slice(0, 6)].map((y) => (
                <button key={y} className={`sd-filter ${year === y ? 'sd-selected' : ''}`} onClick={() => setYear(y)}>
                  {y === 'all' ? t('Barcha imtihonlar') : y}
                </button>
              ))}
              {years.length > 6 && (
                <select className={`sd-ex-select ${years.slice(6).includes(year) ? 'sd-selected' : ''}`} value={years.slice(6).includes(year) ? year : ''} onChange={(e) => e.target.value && setYear(e.target.value)} aria-label={t('Yana')}>
                  <option value="">{t('Yana')}</option>
                  {years.slice(6).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="sd-ex-tools">
              <label className="sd-ex-search">
                <Search />
                <input
                  value={q}
                  placeholder={t('Mock nomi yoki oy...')}
                  onChange={(e) => {
                    setQ(e.target.value.toLowerCase())
                    window.history.replaceState(null, '', '/dashboard/practice')
                  }}
                />
              </label>
              <select className="sd-ex-select" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label={t('Barchasi')}>
                <option value="all">{t('Barchasi')}</option>
                <option value="full">{t('Full SAT Mock')}</option>
                <option value="math">{t('Faqat Math')}</option>
                <option value="english">{t('Faqat R&W')}</option>
              </select>
              <select className="sd-ex-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label={t('Yangidan eski')}>
                <option value="new">{t('Yangidan eski')}</option>
                <option value="old">{t('Eskidan yangi')}</option>
              </select>
            </div>
          </div>

          {tests === null && <SatSkeleton kind="cards" count={3} />}
          <div className="sd-tl">
            {sections.map(([y, list], si) => (
              <section key={y || 'other'} className="sd-year-block" style={{ ['--yh' as string]: (si * 47 + 205) % 360 }}>
                <div className="sd-year-head">
                  <h2>{y || t('Boshqa imtihonlar')}</h2>
                  <span>{t('{n} ta imtihon', { n: list.length })}</span>
                  {y && year === 'all' && (
                    <button className="sd-ex-all" onClick={() => setYear(y)}>
                      {t("Barchasini ko'rish")} <ArrowRight />
                    </button>
                  )}
                </div>
                <div className="sd-ex-grid">
                  {list.map((g) => (
                    <ExamCard key={g.name} group={g} lang={lang} onOpen={() => show(g.name)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
          {tests !== null && visible.length === 0 && (
            <p className="sd-note">{mocks.length === 0 ? t("Hozircha mocklar yo'q — tez orada qo'shiladi.") : t('Hech narsa topilmadi.')}</p>
          )}
          {tests !== null && !q && year === 'all' && (
            <div className="sd-exam-grid" style={{ marginTop: 18 }}>
              <GhostCards count={3} label={t('Yangi mock tayyorlanmoqda')} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

const seasonOf = (m: number) => (m < 0 ? 'none' : m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn')
const SEASON = {
  autumn: { sky: ['#ffd9a8', '#ffb36b'], hill: ['#d9822b', '#b9611d'], leaf: ['#e8590c', '#f59e0b'] },
  winter: { sky: ['#c9e3ff', '#eef6ff'], hill: ['#ffffff', '#d6e6fb'], leaf: ['#9fb7d6', '#9fb7d6'] },
  spring: { sky: ['#d6efff', '#fde4f2'], hill: ['#86d37a', '#58b95f'], leaf: ['#f9a8d4', '#fbcfe8'] },
  summer: { sky: ['#8fd3ff', '#e0f6ff'], hill: ['#4ade80', '#1fb85a'], leaf: ['#16a34a', '#22c55e'] },
  none: { sky: ['#cbd5e1', '#e2e8f0'], hill: ['#94a3b8', '#64748b'], leaf: ['#64748b', '#94a3b8'] },
} as const

/** Small hand-drawn scene for the exam's season (no photos: nothing to download, nothing to license). */
function MonthArt({ month, id }: { month: number; id: string }) {
  const sn = seasonOf(month)
  const c = SEASON[sn]
  return (
    <svg viewBox="0 0 120 150" className="sd-ex-art" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.sky[0]} />
          <stop offset="1" stopColor={c.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="120" height="150" fill={`url(#sky-${id})`} />
      {sn === 'summer' && <circle cx="92" cy="34" r="14" fill="#fde047" />}
      {sn === 'autumn' && <circle cx="90" cy="38" r="12" fill="#fff3d6" opacity=".9" />}
      {sn === 'spring' && <circle cx="30" cy="34" r="11" fill="#fff7c2" />}
      {sn === 'winter' && (
        <g fill="#fff">
          {[[18, 30], [44, 18], [72, 40], [100, 22], [30, 62], [88, 66], [58, 54], [108, 52]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.4 : 1.6} />
          ))}
        </g>
      )}
      {/* a campus hall */}
      <g transform="translate(36 70)">
        <rect x="0" y="22" width="48" height="36" fill={sn === 'winter' ? '#e9d5c0' : '#f3e2cf'} />
        <path d="M-4 22 24 2 52 22Z" fill={sn === 'winter' ? '#f8fbff' : '#b45309'} />
        <rect x="19" y="-6" width="10" height="14" fill="#f3e2cf" />
        <path d="M17 -6 24 -16 31 -6Z" fill={sn === 'winter' ? '#f8fbff' : '#b45309'} />
        {[6, 20, 34].map((x) => (
          <rect key={x} x={x} y="32" width="8" height="12" rx="4" fill="#7c5a3a" opacity=".55" />
        ))}
      </g>
      {/* hills */}
      <ellipse cx="24" cy="146" rx="78" ry="30" fill={c.hill[0]} />
      <ellipse cx="104" cy="152" rx="70" ry="30" fill={c.hill[1]} />
      {/* tree */}
      <rect x="14" y="94" width="5" height="34" rx="2" fill="#6b4423" />
      {sn === 'winter' ? (
        <g stroke="#6b4423" strokeWidth="2" strokeLinecap="round">
          <path d="M16 100 6 88M16 106 28 94M16 96 18 82" />
        </g>
      ) : (
        <g>
          <circle cx="16" cy="88" r="15" fill={c.leaf[0]} />
          <circle cx="6" cy="98" r="10" fill={c.leaf[1]} />
          <circle cx="27" cy="96" r="10" fill={c.leaf[1]} />
        </g>
      )}
      {sn === 'autumn' && (
        <g fill={c.leaf[0]}>
          {[[40, 132], [58, 140], [78, 134], [96, 142]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="3" ry="1.8" transform={`rotate(${i * 30} ${x} ${y})`} />
          ))}
        </g>
      )}
    </svg>
  )
}

/** A real picture from /public/covers (month file first, then the season), the drawn scene underneath as the fallback. */
function Cover({ srcs, children }: { srcs: string[]; children: React.ReactNode }) {
  const [i, setI] = useState(0)
  return (
    <>
      {children}
      {i < srcs.length && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={srcs[i]} alt="" loading="lazy" decoding="async" className="sd-cover-img" onError={() => setI(i + 1)} />
      )}
    </>
  )
}

/** Wide campus scene for the page banner (used until /covers/hero.jpg exists). */
function HeroArt() {
  return (
    <svg viewBox="0 0 800 220" className="sd-ex-art" preserveAspectRatio="xMaxYMid slice" aria-hidden>
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3bd" />
          <stop offset="1" stopColor="#ffb878" />
        </linearGradient>
      </defs>
      <rect width="800" height="220" fill="url(#hero-sky)" />
      <circle cx="560" cy="60" r="26" fill="#fff3d6" opacity=".9" />
      <g transform="translate(470 40)">
        <rect x="0" y="70" width="230" height="110" fill="#e9cfae" />
        <rect x="90" y="10" width="50" height="170" fill="#e2c39b" />
        <path d="M84 12 115 -24 146 12Z" fill="#9a4a14" />
        <path d="M-6 70 40 36 86 70Z M144 70 190 36 236 70Z" fill="#a8531a" />
        {[10, 34, 58, 150, 174, 198].map((x) => (
          <rect key={x} x={x} y="92" width="14" height="30" rx="7" fill="#7c5a3a" opacity=".55" />
        ))}
        {[100, 118].map((x) => (
          <rect key={x} x={x} y="40" width="10" height="26" rx="5" fill="#7c5a3a" opacity=".55" />
        ))}
      </g>
      {[[420, 130, 34], [740, 120, 40], [380, 150, 24], [780, 150, 28]].map(([x, y, r], i) => (
        <g key={i}>
          <rect x={x - 3} y={y} width="7" height="60" rx="3" fill="#6b4423" />
          <circle cx={x} cy={y - 6} r={r} fill={i % 2 ? '#e8590c' : '#f59e0b'} />
          <circle cx={x - r * 0.5} cy={y + 8} r={r * 0.65} fill="#f97316" />
        </g>
      ))}
      <ellipse cx="520" cy="228" rx="420" ry="40" fill="#c8742a" />
    </svg>
  )
}

/** One exam (a month): picture with the month badge, name, chips and the button — a column on the year timeline. */
function ExamCard({ group, lang, onOpen }: { group: ExamGroup<TestSummary>; lang: Lang; onOpen: () => void }) {
  const { t } = useI18n()
  const done = group.versions.filter((v) => v.test.done).length
  const p = parseExam(group.name)
  const total = group.versions.length
  const monthName = p.month >= 0 ? MONTH_NAMES[lang][p.month] : ''
  const title = p.month >= 0 ? `${p.rest ? `${p.rest} ` : ''}${monthName}${p.year ? ` ${p.year}` : ''}` : group.name
  const badge = p.month >= 0 ? MONTH_NAMES[lang][p.month].slice(0, 3).toUpperCase() : ''
  const mm = String(p.month + 1).padStart(2, '0')
  const srcs = p.month >= 0 ? [`/covers/m${mm}.webp`, `/covers/${seasonOf(p.month)}.webp`] : []
  return (
    <div className="sd-ex-card" style={bannerStyle(p.month, group.name)} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="sd-ex-media">
        <Cover srcs={srcs}>
          <MonthArt month={p.month} id={group.name.replace(/\W/g, '')} />
        </Cover>
        {(badge || p.year) && (
          <span className="sd-ex-badge">
            <b>{badge}</b>
            <small>{p.year}</small>
          </span>
        )}
        {done === total && total > 0 && (
          <span className="sd-ex-done" title={t('Bajarilgan')}>
            <CheckCircle2 />
          </span>
        )}
      </div>
      <div className="sd-ex-body">
        <h3>{title}</h3>
        <div className="sd-ex-chips">
          <span className={`sd-tag ${done > 0 ? 'sd-done' : ''}`}>
            {done > 0 ? <CheckCircle2 /> : <Layers />} {done > 0 ? t('{a}/{b} bajarilgan', { a: done, b: total }) : t('{n} ta versiya', { n: total })}
          </span>
        </div>
        <button className="sd-ex-go" onClick={(e) => { e.stopPropagation(); onOpen() }}>
          {t('Yechish')} <ArrowRight />
        </button>
      </div>
    </div>
  )
}

function ExamDetail({ group, onBack }: { group: ExamGroup<TestSummary>; onBack: () => void }) {
  const { t, lang } = useI18n()
  const p = parseExam(group.name)
  const monthName = p.month >= 0 ? MONTH_NAMES[lang][p.month] : ''
  const title = p.month >= 0 ? `${monthName}${p.year ? ` ${p.year}` : ''}` : group.name
  const done = group.versions.filter((v) => v.test.done).length
  const total = group.versions.length
  const questions = group.versions.reduce((n, v) => n + (v.test.subject !== 'english' ? v.test.mathCount : 0) + (v.test.subject !== 'math' ? v.test.readingCount : 0), 0)
  const mm = String(p.month + 1).padStart(2, '0')
  const srcs = p.month >= 0 ? [`/covers/m${mm}.webp`, `/covers/${seasonOf(p.month)}.webp`] : []
  const regions = [...new Set(group.versions.map((v) => v.region).filter(Boolean))] as string[]

  return (
    <div className="sd-xd" style={bannerStyle(p.month, group.name)}>
      <button className="sd-back" onClick={onBack}>
        <ChevronLeft size={15} /> {t('Barcha imtihonlar')}
      </button>

      <section className="sd-xd-hero">
        <div className="sd-xd-art">
          <Cover srcs={srcs}>
            <MonthArt month={p.month} id={`d${group.name.replace(/\W/g, '')}`} />
          </Cover>
        </div>
        <div className="sd-xd-fade" />
        <div className="sd-xd-copy">
          <div className="sd-xd-kicker">{p.rest || 'SAT'} · {t('Barcha o‘tgan imtihonlar')}</div>
          <h1>{title}</h1>
          <div className="sd-xd-stats">
            <span>
              <Layers /> <b>{total}</b> {t('versiya')}
            </span>
            <span className={done ? 'sd-on' : ''}>
              <CheckCircle2 /> <b>{done}</b>/{total} {t('bajarilgan')}
            </span>
            {questions > 0 && (
              <span>
                <PenLine /> <b>{questions}</b> {t('savol')}
              </span>
            )}
            {regions.length > 0 && (
              <span>
                <Globe2 /> {regions.join(' · ')}
              </span>
            )}
          </div>
          <div className="sd-xd-progress" aria-hidden>
            <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      </section>

      <div className="sd-xd-head">
        <h2>{t('Versiyani tanlang')}</h2>
        <small>{t("Har bir versiya — alohida to'liq test. Istalganidan boshlang.")}</small>
      </div>

      <div className="sd-xd-list">
        {group.versions.map(({ version, region, test: x }) => {
          const ready = isReady(x)
          const minutes = x.subject === 'math' ? 70 : x.subject === 'english' ? 64 : 134
          return (
            <article key={x.label} className={`sd-xd-row ${ready ? '' : 'sd-soon'} ${x.done ? 'sd-done' : ''}`}>
              <div className="sd-xd-letter">
                <small>{t('Versiya')}</small>
                <b>{version}</b>
              </div>
              <div className="sd-xd-main">
                <div className="sd-xd-title">
                  <strong>{t(subjectLabel(x))}</strong>
                  {region && <span className="sd-xd-region">{region === 'International' ? t('International') : region}</span>}
                  {x.done && (
                    <span className="sd-ver-done">
                      <CheckCircle2 /> {t('Bajarilgan')}
                    </span>
                  )}
                </div>
                <div className="sd-xd-label">{x.label}</div>
                <div className="sd-chips">
                  {x.subject !== 'math' && (
                    <span className="sd-chip">
                      <PenLine /> {t('{n} R&W savol', { n: x.readingCount })}
                    </span>
                  )}
                  {x.subject !== 'english' && (
                    <span className="sd-chip">
                      <Calculator /> {t('{n} Math savol', { n: x.mathCount })}
                    </span>
                  )}
                  {x.scored ? (
                    <span className="sd-chip">
                      <Clock /> ≈{minutes} {t('daq')}
                    </span>
                  ) : (
                    <span className="sd-chip">
                      <Timer /> {t('Erkin mashq')}
                    </span>
                  )}
                  {x.hasVideo && (
                    <span className="sd-chip">
                      <MonitorPlay /> {t('Video tahlil')}
                    </span>
                  )}
                </div>
              </div>
              <div className="sd-xd-actions">
                {ready ? (
                  <Link href={`/exam?test=${encodeURIComponent(x.label)}`} className={x.done ? 'sd-soft' : 'sd-primary'}>
                    {x.done ? <RotateCcw /> : <Play />} {x.done ? t('Qayta ishlash') : t('Boshlash')}
                  </Link>
                ) : (
                  <span className="sd-soft sd-lock-btn">
                    <Lock /> {t('Tez orada')}
                  </span>
                )}
                {x.hasVideo && x.done && (
                  <Link href={`/dashboard/analysis?test=${encodeURIComponent(x.label)}`} className="sd-soft">
                    <MonitorPlay /> {t('Video tahlil')}
                  </Link>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
