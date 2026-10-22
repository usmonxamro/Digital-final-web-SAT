'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Bot, CalendarDays, CheckCircle2, ChartColumn, Crosshair, FileText, Globe, Play, RotateCcw, Search, Trophy, XCircle } from 'lucide-react'
import { useDashboardData, type Attempt, type BotAttempt } from '@/components/marketing/dashboard/dashboard-data'
import { SatSkeleton } from '@/components/sat-loader'
import { useI18n } from '@/components/i18n-provider'
import type { Lang } from '@/lib/i18n'

const MONTHS: Record<Lang, string[]> = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
function shortDate(iso: string, lang: Lang) {
  const [y, m, d] = dayKey(iso).split('-').map(Number)
  const thisYear = Number(dayKey(new Date().toISOString()).slice(0, 4))
  return `${d} ${MONTHS[lang][m - 1]}${y !== thisYear ? ` ${y}` : ''}`
}

const maxOf = (a: Attempt) => (a.subject === 'full' ? 1600 : 800)
const pctOf = (a: Attempt) => Math.round(((a.composite - (a.subject === 'full' ? 400 : 200)) / (maxOf(a) - (a.subject === 'full' ? 400 : 200))) * 100)
const tone = (p: number) => (p >= 75 ? 'sd-g' : p >= 55 ? 'sd-y' : 'sd-r')
const subj = (s: Attempt['subject']) => (s === 'full' ? 'SAT' : s === 'math' ? 'MATH' : 'R&W')

type MockRow = { label: string; subject: Attempt['subject']; list: Attempt[]; best: Attempt; last: Attempt }

/** "Natijalarim": every mock the student solved — on the site and through the Telegram bot — with trends and per-mock bests. */
export default function ResultsPage() {
  const { t, lang } = useI18n()
  const { attempts, botAttempts } = useDashboardData()
  const [src, setSrc] = useState<'all' | 'site' | 'bot'>('all')
  const [q, setQ] = useState('')
  const [view, setView] = useState<'mocks' | 'history'>('mocks')

  const site = attempts ?? []
  const bot = botAttempts ?? []

  const summary = useMemo(() => {
    let c = 0
    let tot = 0
    for (const a of site) {
      const x = a.correct_count ?? 0
      c += x
      tot += x + (a.incorrect_count ?? 0) + (a.omitted_count ?? 0)
    }
    for (const b of bot) {
      c += b.correct
      tot += b.total
    }
    const math = site.filter((a) => a.subject === 'math')
    const bestMath = math.length ? Math.max(...math.map((a) => a.composite)) : null
    const avgMath = math.length ? Math.round(math.reduce((s, a) => s + a.composite, 0) / math.length / 10) * 10 : null
    const full = site.filter((a) => a.subject === 'full')
    const bestFull = full.length ? Math.max(...full.map((a) => a.composite)) : null
    return { count: site.length + bot.length, acc: tot ? Math.round((c / tot) * 100) : null, bestMath, avgMath, bestFull }
  }, [site, bot])

  const mocks = useMemo(() => {
    const by = new Map<string, Attempt[]>()
    for (const a of site) by.set(a.test_label, [...(by.get(a.test_label) ?? []), a])
    const rows: MockRow[] = [...by.entries()].map(([label, list]) => ({
      label,
      subject: list[0].subject,
      list,
      best: list.reduce((b, a) => (a.composite > b.composite ? a : b)),
      last: list[0],
    }))
    return rows.sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1))
  }, [site])

  const ql = q.trim().toLowerCase()
  const shownMocks = mocks.filter((m) => !ql || m.label.toLowerCase().includes(ql))
  const shownBot = bot.filter((b) => !ql || b.name.toLowerCase().includes(ql) || b.code.includes(ql))
  const history = useMemo(() => {
    const rows: ({ kind: 'site'; at: string; a: Attempt } | { kind: 'bot'; at: string; b: BotAttempt })[] = [
      ...site.map((a) => ({ kind: 'site' as const, at: a.created_at, a })),
      ...bot.map((b) => ({ kind: 'bot' as const, at: b.at, b })),
    ]
    return rows.sort((x, y) => (x.at < y.at ? 1 : -1))
  }, [site, bot])
  const shownHistory = history.filter(
    (r) =>
      (src === 'all' || r.kind === src) &&
      (!ql || (r.kind === 'site' ? r.a.test_label : `${r.b.name} ${r.b.code}`).toLowerCase().includes(ql)),
  )

  const loading = attempts === null
  const empty = !loading && site.length === 0 && bot.length === 0

  return (
    <>
      <div className="sd-page-header">
        <div>
          <div className="sd-eyebrow">{t('SAT Akademiyasi / Natijalar')}</div>
          <h1>{t('Natijalarim')}</h1>
        </div>
        {!loading && <span className="sd-pill">{t('{n} ta urinish', { n: summary.count })}</span>}
      </div>

      {loading && <SatSkeleton kind="cards" count={4} />}

      {empty && (
        <div className="sd-rs-empty">
          <span className="sd-rs-empty-ico">
            <ChartColumn />
          </span>
          <h2>{t('Hali natija yo‘q')}</h2>
          <p>{t('Birinchi mockni yeching — natijalaringiz, ballaringiz o‘sishi va har bir mock bo‘yicha tahlil shu yerda paydo bo‘ladi.')}</p>
          <Link href="/dashboard/practice" className="sd-primary">
            <Play /> {t('Test ishlashni boshlash')}
          </Link>
        </div>
      )}

      {!loading && !empty && (
        <>
          <section className="sd-rs-stats">
            <div className="sd-rs-stat">
              <span className="sd-stat-icon">
                <FileText />
              </span>
              <div>
                <small>{t('Jami urinishlar')}</small>
                <b>{summary.count}</b>
                <em>
                  {t('Sayt')}: {site.length} · {t('Bot')}: {bot.length}
                </em>
              </div>
            </div>
            <div className="sd-rs-stat">
              <span className="sd-stat-icon sd-yellow">
                <Trophy />
              </span>
              <div>
                <small>{t('Eng yuqori Math')}</small>
                <b>
                  {summary.bestMath ?? '—'}
                  {summary.bestMath ? <i> / 800</i> : null}
                </b>
                <em>{summary.bestFull ? `${t('Full SAT')}: ${summary.bestFull} / 1600` : t('Sayt mocklari bo‘yicha')}</em>
              </div>
            </div>
            <div className="sd-rs-stat">
              <span className="sd-stat-icon sd-violet">
                <ChartColumn />
              </span>
              <div>
                <small>{t('O‘rtacha Math ball')}</small>
                <b>{summary.avgMath ?? '—'}</b>
                <em>{t('Barcha Math mocklar')}</em>
              </div>
            </div>
            <div className="sd-rs-stat">
              <span className="sd-stat-icon sd-green">
                <Crosshair />
              </span>
              <div>
                <small>{t('Aniqlik')}</small>
                <b>{summary.acc === null ? '—' : `${summary.acc}%`}</b>
                <em>{t('To‘g‘ri javoblar ulushi')}</em>
              </div>
            </div>
          </section>

          {site.length > 1 && <TrendChart attempts={site} lang={lang} />}

          <div className="sd-rs-bar">
            <div className="sd-rs-tabs">
              <button className={view === 'mocks' ? 'sd-on' : ''} onClick={() => setView('mocks')}>
                {t('Mocklar bo‘yicha')}
              </button>
              <button className={view === 'history' ? 'sd-on' : ''} onClick={() => setView('history')}>
                {t('Barcha urinishlar')}
              </button>
            </div>
            <label className="sd-ex-search">
              <Search />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Mock nomi...')} />
            </label>
          </div>

          {view === 'mocks' ? (
            <>
              {shownMocks.length > 0 && (
                <div className="sd-rs-grid">
                  {shownMocks.map((m) => {
                    const p = pctOf(m.best)
                    return (
                      <article key={m.label} className="sd-rs-mock">
                        <div className="sd-rs-mock-top">
                          <span className={`sd-thumb ${m.subject === 'math' ? '' : m.subject === 'full' ? 'sd-green' : 'sd-yellow'}`}>{subj(m.subject)}</span>
                          <div className="sd-rs-mock-name">
                            <strong title={m.label}>{m.label}</strong>
                            <small>
                              <CalendarDays /> {shortDate(m.last.created_at, lang)} · {t('{n} marta', { n: m.list.length })}
                            </small>
                          </div>
                        </div>
                        <div className="sd-rs-score">
                          <div>
                            <small>{t('Eng yaxshi')}</small>
                            <b className={tone(p)}>
                              {m.best.composite}
                              <i> / {maxOf(m.best)}</i>
                            </b>
                          </div>
                          <div>
                            <small>{t('Oxirgi')}</small>
                            <b>{m.last.composite}</b>
                          </div>
                          <Spark list={m.list} />
                        </div>
                        <AnswerBar a={m.last} />
                        <div className="sd-rs-mock-foot">
                          <Link href={`/exam?test=${encodeURIComponent(m.label)}`} className="sd-soft">
                            <RotateCcw /> {t('Qayta ishlash')}
                          </Link>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
              {shownBot.length > 0 && (
                <>
                  <div className="sd-section-title" style={{ marginTop: 26 }}>
                    <h3>
                      <Bot size={17} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />
                      {t('Telegram bot orqali yechilganlar')}
                    </h3>
                  </div>
                  <div className="sd-panel sd-rs-botlist">
                    {shownBot.map((b, i) => (
                      <BotRow key={`${b.code}-${b.at}-${i}`} b={b} lang={lang} />
                    ))}
                  </div>
                </>
              )}
              {shownMocks.length === 0 && shownBot.length === 0 && <p className="sd-note">{t('Hech narsa topilmadi.')}</p>}
            </>
          ) : (
            <>
              <div className="sd-filters" style={{ marginBottom: 12 }}>
                {(
                  [
                    ['all', t('Hammasi')],
                    ['site', t('Sayt')],
                    ['bot', t('Telegram bot')],
                  ] as const
                ).map(([k, l]) => (
                  <button key={k} className={`sd-filter ${src === k ? 'sd-selected' : ''}`} onClick={() => setSrc(k)}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="sd-panel sd-rs-history">
                {shownHistory.length === 0 && <div className="sd-empty">{t('Hech narsa topilmadi.')}</div>}
                {shownHistory.map((r, i) =>
                  r.kind === 'site' ? (
                    <div key={r.a.id} className="sd-rs-hrow">
                      <span className="sd-rs-src" title={t('Sayt')}>
                        <Globe />
                      </span>
                      <div className="sd-rs-hmain">
                        <strong>{r.a.test_label}</strong>
                        <small>
                          {shortDate(r.a.created_at, lang)} · {subj(r.a.subject)}
                        </small>
                        <AnswerBar a={r.a} compact />
                      </div>
                      <div className={`sd-score ${tone(pctOf(r.a))}`}>
                        <strong>
                          {r.a.composite} / {maxOf(r.a)}
                        </strong>
                        <small>
                          {r.a.correct_count ?? 0} {t('to‘g‘ri')}
                        </small>
                      </div>
                    </div>
                  ) : (
                    <BotRow key={`h${i}`} b={r.b} lang={lang} />
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

function BotRow({ b, lang }: { b: BotAttempt; lang: Lang }) {
  const { t } = useI18n()
  const p = b.total ? Math.round((b.correct / b.total) * 100) : 0
  return (
    <div className="sd-rs-hrow">
      <span className="sd-rs-src sd-bot" title="Telegram bot">
        <Bot />
      </span>
      <div className="sd-rs-hmain">
        <strong>{b.name}</strong>
        <small>
          {shortDate(b.at, lang)} · {t('kod')} {b.code}
          {b.siteLabel ? ` · ${t('saytda')}: ${b.siteLabel}` : ''}
        </small>
      </div>
      <div className={`sd-score ${tone(p)}`}>
        <strong>{b.score && /^\d+$/.test(b.score) ? `${b.score} / 800` : `${b.correct} / ${b.total}`}</strong>
        <small>
          {b.correct}/{b.total} · {p}%
        </small>
      </div>
    </div>
  )
}

/** Correct / incorrect / omitted as one split bar. */
function AnswerBar({ a, compact }: { a: Attempt; compact?: boolean }) {
  const { t } = useI18n()
  const c = a.correct_count ?? 0
  const w = a.incorrect_count ?? 0
  const o = a.omitted_count ?? 0
  const n = c + w + o
  if (!n) return null
  return (
    <div className={`sd-rs-ans ${compact ? 'sd-compact' : ''}`}>
      <div className="sd-rs-ans-bar">
        <i className="c" style={{ width: `${(c / n) * 100}%` }} />
        <i className="w" style={{ width: `${(w / n) * 100}%` }} />
        <i className="o" style={{ width: `${(o / n) * 100}%` }} />
      </div>
      {!compact && (
        <div className="sd-rs-ans-legend">
          <span className="c">
            <CheckCircle2 /> {c} {t('to‘g‘ri')}
          </span>
          <span className="w">
            <XCircle /> {w} {t('xato')}
          </span>
          {o > 0 && <span className="o">{t('{n} ta tashlab ketilgan', { n: o })}</span>}
        </div>
      )}
    </div>
  )
}

/** Tiny bar chart of a mock's attempts (oldest → newest). */
function Spark({ list }: { list: Attempt[] }) {
  const pts = [...list].reverse().slice(-8)
  if (pts.length < 2) return <span className="sd-rs-spark" />
  return (
    <span className="sd-rs-spark" aria-hidden>
      {pts.map((a) => (
        <i key={a.id} style={{ height: `${Math.max(12, pctOf(a))}%` }} />
      ))}
    </span>
  )
}

/** Score trend over the last attempts (200–800 axis; a full SAT is shown at half scale so every point fits).
 *  Lines are SVG stretched to the box; dots and labels are HTML, so text never scales with the width. */
function TrendChart({ attempts, lang }: { attempts: Attempt[]; lang: Lang }) {
  const { t } = useI18n()
  const pts = [...attempts].reverse().slice(-16)
  const n = pts.length
  const xPct = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100)
  const yPct = (a: Attempt) => {
    const v = a.subject === 'full' ? a.composite / 2 : a.composite
    return (1 - Math.max(0, Math.min(1, (v - 200) / 600))) * 100
  }
  const line = pts.map((a, i) => `${i ? 'L' : 'M'}${xPct(i).toFixed(2)},${yPct(a).toFixed(2)}`).join(' ')
  const area = `${line} L${xPct(n - 1)},100 L${xPct(0)},100 Z`
  const delta = pts[n - 1].composite - pts[0].composite
  const every = n > 8 ? Math.ceil(n / 6) : 1
  return (
    <section className="sd-panel sd-rs-trend">
      <div className="sd-active-plan">
        <strong>{t('Ball dinamikasi')}</strong>
        <small className={delta >= 0 ? 'sd-up' : 'sd-down'}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} {t('ball')} · {t('so‘nggi {n} ta', { n })}
        </small>
      </div>
      <div className="sd-rs-chart" role="img" aria-label={t('Ball dinamikasi')}>
        <div className="sd-rs-y">
          {[800, 650, 500, 350, 200].map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <div className="sd-rs-plot">
          {[0, 25, 50, 75, 100].map((g) => (
            <i key={g} className="sd-rs-gl" style={{ top: `${g}%` }} />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="rs-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--sp-orange)" stopOpacity=".26" />
                <stop offset="1" stopColor="var(--sp-orange)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#rs-fill)" />
            <path d={line} fill="none" stroke="var(--sp-orange)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {pts.map((a, i) => (
            <span key={a.id} className="sd-rs-pt" style={{ left: `${xPct(i)}%`, top: `${yPct(a)}%` }} title={`${a.test_label}: ${a.composite}`}>
              <em>{a.composite}</em>
            </span>
          ))}
        </div>
        <div className="sd-rs-x">
          {pts.map((a, i) =>
            i % every === 0 || i === n - 1 ? (
              <span key={a.id} style={{ left: `${xPct(i)}%` }}>
                {shortDate(a.created_at, lang)}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </section>
  )
}
