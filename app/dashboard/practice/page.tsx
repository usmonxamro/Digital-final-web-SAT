'use client'

import { SatSkeleton } from '@/components/sat-loader'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Calculator, CheckCircle2, Crown, Lock, MonitorPlay, Play, Timer, ChevronLeft, PenLine, Layers } from 'lucide-react'
import { useDashboardData, type TestSummary } from '@/components/marketing/dashboard/dashboard-data'
import { groupExams, type ExamGroup } from '@/lib/exam-groups'
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

const EN_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MONTH_NAMES: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
}

/** "October 2026 SAT" → month index 9, year 2026 and the rest of the name ("SAT"). */
function parseExam(name: string) {
  const lower = name.toLowerCase()
  const mi = EN_MONTHS.findIndex((m) => new RegExp(`\\b${m}\\b`).test(lower))
  const year = name.match(/\b(20\d{2})\b/)?.[1] ?? null
  let rest = name
  if (mi >= 0) rest = rest.replace(new RegExp(EN_MONTHS[mi], 'i'), '')
  if (year) rest = rest.replace(year, '')
  rest = rest.replace(/[—–\-,()]/g, ' ').replace(/\s+/g, ' ').trim()
  return { month: mi, year, rest }
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
      (!q || g.name.toLowerCase().includes(q) || g.versions.some((v) => v.test.label.toLowerCase().includes(q))),
  )
  // Sections: one per year (newest first), then everything without a year.
  const sections = useMemo(() => {
    const by = new Map<string, ExamGroup<TestSummary>[]>()
    for (const g of visible) {
      const k = g.year ?? ''
      by.set(k, [...(by.get(k) ?? []), g])
    }
    return [...by.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : b[0].localeCompare(a[0])))
  }, [visible])
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
              <div className="sd-eyebrow">{t('SAT Akademiyasi / Testlar')}</div>
              <h1>{t('Barcha o‘tgan imtihonlar')}</h1>
            </div>
            <span className="sd-pill">{t('Imtihonlar arxivi')}</span>
          </div>
          <p className="sd-note">{t('Imtihon nomini tanlang va ichidagi versiyalardan birini ishlang. Barqarorlik — muvaffaqiyat kaliti.')}</p>

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

          {years.length > 0 && (
            <div className="sd-filters">
              {['all', ...years].map((y) => (
                <button key={y} className={`sd-filter ${year === y ? 'sd-selected' : ''}`} onClick={() => setYear(y)}>
                  {y === 'all' ? t('Barcha imtihonlar') : t('{y} yil', { y })}
                </button>
              ))}
              {q && (
                <span className="sd-chip">
                  {t('Qidiruv')}: “{q}”{' '}
                  <button
                    className="sd-text-btn"
                    onClick={() => {
                      setQ('')
                      window.history.replaceState(null, '', '/dashboard/practice')
                    }}
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
          )}

          {tests === null && <SatSkeleton kind="cards" count={3} />}
          {sections.map(([y, list]) => (
            <section key={y || 'other'} className="sd-year-block">
              <div className="sd-year-head">
                <h2>{y || t('Boshqa imtihonlar')}</h2>
                <span>{t('{n} ta imtihon', { n: list.length })}</span>
              </div>
              <div className="sd-mo-grid">
                {list.map((g) => (
                  <ExamCard key={g.name} group={g} lang={lang} onOpen={() => show(g.name)} />
                ))}
              </div>
            </section>
          ))}
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

/** One exam (a month): a coloured banner with the month, the year, how many versions and how many are done. */
function ExamCard({ group, lang, onOpen }: { group: ExamGroup<TestSummary>; lang: Lang; onOpen: () => void }) {
  const { t } = useI18n()
  const done = group.versions.filter((v) => v.test.done).length
  const hasFull = group.versions.some((v) => v.test.subject === 'full')
  const p = parseExam(group.name)
  const title = p.month >= 0 ? MONTH_NAMES[lang][p.month] : group.name
  const total = group.versions.length
  return (
    <button className="sd-mo-card" style={bannerStyle(p.month, group.name)} onClick={onOpen}>
      <span className="sd-mo-banner">
        <span className="sd-mo-year">{p.year ?? ''}</span>
        <span className="sd-mo-title">{title}</span>
        {p.rest && p.month >= 0 && <span className="sd-mo-rest">{p.rest}</span>}
        {hasFull && (
          <span className="sd-mo-full">
            <Crown /> {t("TO'LIQ")}
          </span>
        )}
      </span>
      <span className="sd-mo-body">
        <span className="sd-mo-line">
          <Layers /> {t('{n} ta versiya', { n: total })}
        </span>
        <span className="sd-mo-dots" aria-label={`${done}/${total}`}>
          {group.versions.map((v) => (
            <i key={v.test.label} className={v.test.done ? 'sd-on' : ''} title={`${t('Versiya')} ${v.version}`} />
          ))}
        </span>
        <span className="sd-mo-foot">
          <span>{done > 0 ? t('{a}/{b} bajarilgan', { a: done, b: total }) : t('Hali boshlanmagan')}</span>
          <b>
            {t("Ko'rish")} <ArrowRight />
          </b>
        </span>
      </span>
    </button>
  )
}

function ExamDetail({ group, onBack }: { group: ExamGroup<TestSummary>; onBack: () => void }) {
  const { t, lang } = useI18n()
  const p = parseExam(group.name)
  const title = p.month >= 0 ? `${MONTH_NAMES[lang][p.month]}${p.year ? ` ${p.year}` : ''}${p.rest ? ` ${p.rest}` : ''}` : group.name
  return (
    <>
      <button className="sd-back" onClick={onBack}>
        <ChevronLeft size={15} /> {t('Barcha imtihonlar')}
      </button>
      <div className="sd-mo-hero" style={bannerStyle(p.month, group.name)}>
        <div>
          <div className="sd-eyebrow">
            {t('Barcha o‘tgan imtihonlar')} / {title}
          </div>
          <h1>{title}</h1>
        </div>
        <span className="sd-pill">{t('{n} ta versiya', { n: group.versions.length })}</span>
      </div>
      <div className="sd-ver-grid">
        {group.versions.map(({ version, test: x }) => {
          const ready = isReady(x)
          return (
            <div key={x.label} className={`sd-ver-card ${ready ? '' : 'sd-soon'}`} style={bannerStyle(p.month, group.name)}>
              <div className="sd-ver-top">
                <span className="sd-ver-letter">{version}</span>
                <div className="sd-ver-name">
                  <small>{t('Versiya')}</small>
                  <b>{t(subjectLabel(x))}</b>
                </div>
                {x.done && (
                  <span className="sd-ver-done">
                    <CheckCircle2 /> {t('Bajarilgan')}
                  </span>
                )}
              </div>
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
                {!x.scored && (
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
              <div className="sd-ver-actions">
                {ready ? (
                  <Link href={`/exam?test=${encodeURIComponent(x.label)}`} className="sd-primary">
                    <Play /> {x.done ? t('Qayta ishlash') : t('Boshlash')}
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
            </div>
          )
        })}
      </div>
    </>
  )
}
