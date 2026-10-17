'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, ArrowRight, BookOpen, Crown, FileText, Medal, Play, Target, Trophy, Eye, Crosshair, Info } from 'lucide-react'
import { useUser } from '@/components/marketing/dashboard/user-context'
import { studyStreak, useDashboardData, type Attempt } from '@/components/marketing/dashboard/dashboard-data'
import { groupExams } from '@/lib/exam-groups'
import { GhostCards } from '@/components/marketing/dashboard/ghost-cards'
import { Celebration } from '@/components/marketing/dashboard/celebration'
import { useI18n } from '@/components/i18n-provider'
import type { Lang } from '@/lib/i18n'

const TARGET_KEY = 'sd-target-score'
const WEEKDAYS: Record<Lang, string[]> = {
  uz: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'],
  ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}
const SHORT_DAYS: Record<Lang, string[]> = {
  uz: ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
}
const MONTHS: Record<Lang, string[]> = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

const dayKey = (t: number | string) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })

function dateHeading(lang: Lang) {
  const [y, m, d] = dayKey(Date.now()).split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return lang === 'uz' ? `${WEEKDAYS.uz[wd]}, ${d}-${MONTHS.uz[m - 1]} ${y}` : `${WEEKDAYS[lang][wd]}, ${d} ${MONTHS[lang][m - 1]} ${y}`
}

function shortDate(iso: string, lang: Lang) {
  const [, m, d] = dayKey(iso).split('-').map(Number)
  return lang === 'uz' ? `${d}-${MONTHS.uz[m - 1]}` : `${d} ${MONTHS[lang][m - 1]}`
}

function max(a: Attempt) {
  return a.subject === 'full' ? 1600 : 800
}

/** Score on the 1600 scale: a single-subject test counts the missing section as 200. */
function score1600(a: Attempt) {
  return a.composite + (a.subject === 'full' ? 0 : 200)
}

function tone(a: Attempt) {
  const r = a.composite / max(a)
  return r >= 0.75 ? 'sd-g' : r >= 0.6 ? 'sd-y' : 'sd-r'
}

export default function DashboardPage() {
  const { t, lang } = useI18n()
  const user = useUser()
  const { attempts, tests, platform } = useDashboardData()
  const [target, setTarget] = useState(1400)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('1400')

  useEffect(() => {
    try {
      const t = Number(localStorage.getItem(TARGET_KEY))
      if (t >= 400 && t <= 1600) {
        setTarget(t)
        setDraft(String(t))
      }
    } catch {
      /* ignore */
    }
  }, [])

  function saveTarget() {
    const v = Math.round(Number(draft) / 10) * 10
    if (v >= 400 && v <= 1600) {
      setTarget(v)
      try {
        localStorage.setItem(TARGET_KEY, String(v))
      } catch {
        /* ignore */
      }
    }
    setDraft(String(v >= 400 && v <= 1600 ? v : target))
    setEditing(false)
  }

  const stats = useMemo(() => {
    const list = attempts ?? []
    const best = list.length ? Math.max(...list.map(score1600)) : null
    let correct = 0
    let total = 0
    for (const a of list) {
      const c = a.correct_count ?? 0
      total += c + (a.incorrect_count ?? 0) + (a.omitted_count ?? 0)
      correct += c
    }
    const weekAgo = Date.now() - 7 * 86400_000
    const lastWeek = list.filter((a) => new Date(a.created_at).getTime() >= weekAgo).length
    // Tests per day for the last 7 days (oldest → today).
    const days = Array.from({ length: 7 }, (_, i) => {
      const t = Date.now() - (6 - i) * 86400_000
      const key = dayKey(t)
      const [y, m, d] = key.split('-').map(Number)
      return { key, label: SHORT_DAYS[lang][new Date(Date.UTC(y, m - 1, d)).getUTCDay()], n: 0 }
    })
    for (const a of list) {
      const hit = days.find((d) => d.key === dayKey(a.created_at))
      if (hit) hit.n++
    }
    return { best, accuracy: total ? Math.round((correct / total) * 100) : null, count: list.length, lastWeek, days }
  }, [attempts, lang])

  const mocks = useMemo(() => (tests ?? []).filter((t) => t.placement === 'mock' && !t.courseGroup && t.section !== 'free'), [tests])
  const exams = useMemo(() => groupExams(mocks).slice(0, 3), [mocks])
  const streak = studyStreak(attempts)
  const progress = stats.best ? Math.min(100, Math.round((stats.best / target) * 100)) : 0
  const recent = (attempts ?? []).slice(0, 3)
  const maxDay = Math.max(1, ...stats.days.map((d) => d.n))
  const isMember = user.courseMember !== false

  return (
    <>
      <Celebration name={user.firstName} total={attempts?.length ?? null} />
      <div className="sd-page-header">
        <div>
          <div className="sd-eyebrow" suppressHydrationWarning>
            {dateHeading(lang)}
          </div>
          <h1>{t('Xush kelibsiz, {name} 👋', { name: user.firstName })}</h1>
        </div>
        <span className="sd-pill">{streak > 0 ? t('🔥 {n} kun ketma-ket', { n: streak }) : t('● Ta’lim jarayonida')}</span>
      </div>

      <section className="sd-hero">
        <img className="sd-hero-art sd-hero-art-day" src="/assets/student-banner.webp" alt="" width={1600} height={243} decoding="async" fetchPriority="high" />
        <img className="sd-hero-art sd-hero-art-night" src="/assets/student-banner-night.webp" alt="" width={1600} height={243} decoding="async" loading="lazy" />
        <div className="sd-hero-copy">
          <div className="sd-kicker">SAT AKADEMIYASI</div>
          <h2>{t('Katta natijalar kichik qadamlardan boshlanadi.')}</h2>
          <div className="sd-hero-actions">
            <Link href="/dashboard/practice" className="sd-primary">
              <Play /> {t('Test ishlashni boshlash')}
            </Link>
            <Link href="/dashboard/course-tasks" className="sd-soft">
              <BookOpen /> {t('Kurslarim')}
            </Link>
          </div>
        </div>
      </section>

      <section className="sd-stats">
        <div className="sd-stat">
          <div className="sd-stat-top">
            <span className="sd-stat-icon">
              <FileText />
            </span>
            {stats.lastWeek > 0 && <span className="sd-trend"><TrendingUp size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('+{n} shu hafta', { n: stats.lastWeek })}</span>}
          </div>
          <div className="sd-stat-label">{t('Yechilgan testlar')}</div>
          <div className="sd-stat-value">
            {attempts === null ? '…' : stats.count} <small>{t('ta')}</small>
          </div>
        </div>
        <div className="sd-stat">
          <div className="sd-stat-top">
            <span className="sd-stat-icon sd-yellow">
              <Trophy />
            </span>
            {platform?.rank && stats.best ? (
              <span className="sd-trend">
                <Medal size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {t("O'rningiz: #{rank}", { rank: platform.rank })}
              </span>
            ) : null}
          </div>
          <div className="sd-stat-label">{t('Eng yuqori SAT ball')}</div>
          {attempts !== null && stats.best === null ? (
            <span className="sd-stat-empty">
              <Info /> {t('Hali test yechmadingiz')}
            </span>
          ) : (
            <div className="sd-stat-value">
              {stats.best ?? '…'} <small>/ 1600</small>
            </div>
          )}
        </div>
        <div className="sd-stat">
          <div className="sd-stat-top">
            <span className="sd-stat-icon sd-green">
              <Crosshair />
            </span>
          </div>
          <div className="sd-stat-label">{t("O'rtacha aniqlik")}</div>
          {attempts !== null && stats.accuracy === null ? (
            <span className="sd-stat-empty">
              <Info /> {t('Hali test yechmadingiz')}
            </span>
          ) : (
            <div className="sd-stat-value">{stats.accuracy === null ? '…' : `${stats.accuracy}%`}</div>
          )}
        </div>
        <div className="sd-stat">
          <div className="sd-stat-top">
            <span className="sd-stat-icon sd-violet">
              <Eye />
            </span>
            <span className="sd-trend sd-muted">{t('● Jonli')}</span>
          </div>
          <div className="sd-stat-label">{t('Saytga tashriflar')}</div>
          <div className="sd-stat-value">{platform?.visits == null ? '—' : platform.visits.toLocaleString('en-US')}</div>
        </div>
      </section>

      <div className="sd-columns">
        <div>
          <div className="sd-section-title" id="results">
            <h3>{t("So'nggi ishlangan testlar")}</h3>
            <Link href="/dashboard/practice" className="sd-link-btn">
              {t('Barchasi')} <ArrowRight size={13} />
            </Link>
          </div>
          <div className="sd-panel">
            {attempts === null ? (
              <div className="sd-empty">{t('Yuklanmoqda…')}</div>
            ) : recent.length === 0 ? (
              <div className="sd-empty">
                {t('Hali mock yechilmagan.')} <Link href="/dashboard/practice">{t('Birinchi testni boshlang →')}</Link>
              </div>
            ) : (
              recent.map((a, i) => (
                <div className="sd-test-row" key={a.id}>
                  <div className={`sd-thumb ${i === 0 ? '' : i === 1 ? 'sd-green' : 'sd-yellow'}`}>
                    {a.subject === 'full' ? 'SAT' : a.subject === 'math' ? 'MATH' : 'R&W'}
                  </div>
                  <div>
                    <div className="sd-test-name">{a.test_label}</div>
                    <div className="sd-test-meta">
                      {shortDate(a.created_at, lang)} · {a.subject === 'full' ? t('Full Test') : a.subject === 'math' ? 'Math' : 'Reading & Writing'}
                    </div>
                  </div>
                  <div className={`sd-score ${tone(a)}`}>
                    <strong>
                      {a.composite} / {max(a)}
                    </strong>
                    <small>{t('Yakunlangan ✓')}</small>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="sd-section-title">
            <h3>{t('Past Exams')}</h3>
            <Link href="/dashboard/practice" className="sd-link-btn">
              {t('Barchasi')} <ArrowRight size={13} />
            </Link>
          </div>
          {tests === null ? (
            <div className="sd-panel">
              <div className="sd-empty">{t('Yuklanmoqda…')}</div>
            </div>
          ) : exams.length === 0 ? (
            <div className="sd-panel">
              <div className="sd-empty">{t("Hozircha mocklar yo'q — tez orada qo'shiladi.")}</div>
            </div>
          ) : (
            <div className="sd-exam-grid">
              {exams.map((g) => (
                <Link key={g.name} href={`/dashboard/practice?exam=${encodeURIComponent(g.name)}`} className="sd-exam-card">
                  <div className="sd-exam-icon">
                    <BookOpen />
                  </div>
                  <h3>{g.name}</h3>
                  <p>{t("SAT Math va Reading & Writing bo'yicha imtihon variantlari.")}</p>
                  <div className="sd-exam-foot">
                    <span>{t('{n} ta versiya', { n: g.versions.length })}</span>
                    <span>{t("Ko'rish →")}</span>
                  </div>
                </Link>
              ))}
              {exams.length < 3 && <GhostCards count={3 - exams.length} label={t('Yangi mock tayyorlanmoqda')} />}
            </div>
          )}
        </div>

        <div>
          <div className="sd-section-title">
            <h3>{t("O'quv jarayoni")}</h3>
            <Link href="/dashboard/course-tasks" className="sd-link-btn">
              {t('Kurslar')} <ArrowRight size={13} />
            </Link>
          </div>
          <div className="sd-panel">
            <div className="sd-active-plan">
              <strong>{t('SAT maqsadingiz')}</strong>
              {editing ? (
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    className="sd-goal-input"
                    type="number"
                    min={400}
                    max={1600}
                    step={10}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveTarget()}
                  />
                  <button className="sd-edit-btn" onClick={saveTarget}>
                    {t('Saqlash')}
                  </button>
                </span>
              ) : (
                <button className="sd-edit-btn" onClick={() => setEditing(true)} title={t("Maqsadni o'zgartirish")}>
                  {stats.best ?? 0} / {target} ✎
                </button>
              )}
            </div>
            <div className="sd-progress-rail">
              <div className="sd-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="sd-progress-labels">
              <span>{t('Maqsad sari progress')}</span>
              <strong>{progress}%</strong>
            </div>
            <div className="sd-group-card">
              <div className="sd-group-icon">{isMember ? <Crown /> : <Target />}</div>
              <div>
                <strong>{isMember ? t('Kurs vazifalaringiz') : t("Kursga qo'shiling")}</strong>
                <small>{isMember ? t('Yangi vazifalar mavjud') : t('Aktiv kurslar bilan tanishing')}</small>
              </div>
              <Link href="/dashboard/course-tasks" className="sd-primary">
                {t("Ko'rish →")}
              </Link>
            </div>
          </div>

          <div className="sd-section-title">
            <h3>{t('Haftalik faollik')}</h3>
          </div>
          <div className="sd-panel">
            <div className="sd-active-plan">
              <strong>{t('Test ishlash faolligi')}</strong>
              <small>{t("So'nggi 7 kun")}</small>
            </div>
            <div className="sd-mini-chart" aria-label={t('Haftalik faollik')}>
              {stats.days.map((d) => (
                <div key={d.key} className={d.n ? 'sd-hot' : ''} style={{ ['--h' as string]: `${d.n ? Math.max(18, (d.n / maxDay) * 100) : 6}%` }} title={t('{n} ta test', { n: d.n })} />
              ))}
            </div>
            <div className="sd-chart-labels">
              {stats.days.map((d) => (
                <span key={d.key}>{d.label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
