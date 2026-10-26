'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Trophy,
  X,
} from 'lucide-react'
import {
  BotModel,
  KIND_LABEL,
  ago,
  dateOnly,
  dateTime,
  dayMonth,
  isSatMock,
  topWrongAnswers,
  type BotAnalyticsData,
  type BotAnswersData,
  type BotAttempt,
  type MockStats,
} from '@/lib/bot-analytics'

/**
 * Admin "O'quvchilar tahlili": the Telegram bot's results in one place.
 * Groups → (assigned mocks | students) → one mock (ranking, hardest questions) or one student (history, rhythm, scores).
 * Data comes from Supabase (the bot pushes there every 5 minutes) — the bot's own server is never queried.
 */

type Home = 'groups' | 'tests' | 'hard' | 'students'
type View =
  | { k: 'home'; tab: Home }
  | { k: 'group'; chat: number }
  | { k: 'mock'; code: string; chat: number | null }
  | { k: 'student'; tg: number; chat: number | null }

const HOME_TABS: [Home, string][] = [
  ['groups', 'Guruhlar'],
  ['tests', 'Barcha testlar'],
  ['hard', "Ko'p xato qilinadigan savollar"],
  ['students', "Barcha o'quvchilar"],
]

export function StudentsPanel({ headers }: { headers?: Record<string, string> } = {}) {
  const [data, setData] = useState<BotAnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stack, setStack] = useState<View[]>([{ k: 'home', tab: 'groups' }])

  function load() {
    setLoading(true)
    setError(null)
    fetch('/api/admin/bot-analytics', { headers, cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Xatolik')
        if (d.missing) setMissing(true)
        else setData(d)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Server bilan bog'lanib bo'lmadi."))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const model = useMemo(() => (data ? new BotModel(data) : null), [data])
  const view = stack[stack.length - 1]
  const open = (v: View) => {
    setStack((s) => [...s, v])
    if (typeof window !== 'undefined') document.querySelector('.adm-content')?.scrollTo?.({ top: 0 })
    window.scrollTo?.({ top: 0 })
  }
  const back = (i?: number) => setStack((s) => (i == null ? s.slice(0, Math.max(1, s.length - 1)) : s.slice(0, i + 1)))
  const setHome = (tab: Home) => setStack([{ k: 'home', tab }])

  if (missing)
    return (
      <Card>
        <div className="flex items-start gap-2 text-[13px] font-semibold text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> Bot jadvallari Supabase&apos;da topilmadi — bot_to_supabase.py sinxroni yoqilmagan.
        </div>
      </Card>
    )
  if (!model)
    return (
      <Card>
        {error ? (
          <div className="flex items-center gap-3 text-[13px] font-semibold text-red-600">
            {error}
            <button type="button" className="adm-btn" onClick={load}>
              <RefreshCw size={14} /> Qayta urinish
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-ink-faint">
            <Loader2 size={15} className="animate-spin" /> Bot natijalari yuklanmoqda...
          </div>
        )}
      </Card>
    )

  const crumbs = stack.map((v, i) => ({ i, label: crumbLabel(model, v) }))

  return (
    <div className="min-w-0 space-y-4">
      {/* top bar: sections, search, freshness */}
      <div className="flex flex-wrap items-center gap-2">
        {view.k === 'home' ? (
          <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1">
            {HOME_TABS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setHome(k)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                  view.tab === k ? 'bg-green-mist text-green-deep' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <nav className="flex min-w-0 flex-wrap items-center gap-1 text-[12.5px] font-bold">
            <button type="button" onClick={() => back()} className="adm-btn !h-8 !px-2.5" title="Orqaga">
              <ArrowLeft size={14} />
            </button>
            {crumbs.map((c, idx) => (
              <span key={c.i} className="flex min-w-0 items-center gap-1">
                {idx > 0 && <ChevronRight size={13} className="shrink-0 text-ink-faint" />}
                {idx === crumbs.length - 1 ? (
                  <span className="truncate text-ink">{c.label}</span>
                ) : (
                  <button type="button" onClick={() => back(c.i)} className="truncate text-ink-soft hover:text-green-deep">
                    {c.label}
                  </button>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          <StudentSearch model={model} onPick={(tg) => open({ k: 'student', tg, chat: null })} />
          <button type="button" className="adm-btn !h-9" onClick={load} title="Yangilash" disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-ink-faint">
        Ma&apos;lumot {dateTime(model.data.generatedAt)} holatida · bot natijalarni har 5 daqiqada yuboradi · vaqtlar Toshkent bo&apos;yicha
      </p>

      {view.k === 'home' && view.tab === 'groups' && <GroupsHome model={model} open={open} />}
      {view.k === 'home' && view.tab === 'tests' && <TestsHome model={model} open={open} />}
      {view.k === 'home' && view.tab === 'hard' && <HardHome model={model} open={open} />}
      {view.k === 'home' && view.tab === 'students' && <StudentsHome model={model} open={open} />}
      {view.k === 'group' && <GroupView key={view.chat} model={model} chat={view.chat} open={open} />}
      {view.k === 'mock' && <MockView key={`${view.code}|${view.chat}`} model={model} code={view.code} chat={view.chat} open={open} headers={headers} />}
      {view.k === 'student' && <StudentView key={`${view.tg}|${view.chat}`} model={model} tg={view.tg} chat={view.chat} open={open} />}
    </div>
  )
}

function crumbLabel(m: BotModel, v: View): string {
  if (v.k === 'home') return HOME_TABS.find((t) => t[0] === v.tab)?.[1] ?? ''
  if (v.k === 'group') return m.group.get(v.chat)?.title ?? 'Guruh'
  if (v.k === 'mock') return m.testName(v.code)
  return m.name(v.tg)
}

type Open = (v: View) => void

/* ================================= HOME: groups ================================= */

function GroupsHome({ model, open }: { model: BotModel; open: Open }) {
  const [showEmpty, setShowEmpty] = useState(false)
  const all = useMemo(
    () => model.data.groups.map((g) => model.groupSummary(g.chatId)).sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '') || b.members - a.members),
    [model],
  )
  const live = all.filter((s) => s.members > 0 || s.assigned > 0)
  const empty = all.filter((s) => !(s.members > 0 || s.assigned > 0))
  const totalStudents = new Set(model.data.attempts.map((a) => a.tg)).size
  const weekAgo = model.now - 7 * 86_400_000
  const week = model.data.attempts.filter((a) => Date.parse(a.at) >= weekAgo)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Guruhlar" value={live.length} sub={empty.length ? `+${empty.length} ta bo'sh` : 'hammasi faol'} />
        <Tile label="Testlar (botda)" value={model.data.tests.length} sub={`${model.byTest.size} tasi yechilgan`} />
        <Tile label="Natija yuborganlar" value={totalStudents} sub={`${model.data.attempts.length} ta natija`} />
        <Tile label="Shu hafta" value={week.length} sub={`${new Set(week.map((a) => a.tg)).size} ta o'quvchi yubordi`} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {live.map((s) => (
          <button
            key={s.group.chatId}
            type="button"
            onClick={() => open({ k: 'group', chat: s.group.chatId })}
            className="group rounded-2xl border border-line bg-white p-4 text-left transition-colors hover:border-green"
          >
            <div className="mb-3 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-extrabold text-ink">{s.group.title}</div>
                <div className="text-[11.5px] text-ink-faint">
                  {s.group.slug ? <span className="font-bold text-green-deep">{s.group.slug.toUpperCase()} kursi · </span> : null}
                  oxirgi faollik: {ago(s.last, model.now)}
                </div>
              </div>
              <ChevronRight size={17} className="mt-0.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <Mini value={s.members} label="o'quvchi" />
              <Mini value={s.assigned} label="mock" />
              <Mini value={s.active7} label="faol (7 kun)" />
            </div>
            <div className="mb-1 flex items-baseline justify-between text-[11.5px]">
              <span className="font-semibold text-ink-soft">Vazifalar bajarilishi</span>
              <span className="font-black tabular-nums text-ink">{s.completion == null ? '—' : `${Math.round(s.completion)}%`}</span>
            </div>
            <Bar value={s.completion ?? 0} />
            <div className="mt-2 text-[11.5px] text-ink-faint">
              O&apos;rtacha natija: <b className="text-ink">{s.avgPct == null ? '—' : `${Math.round(s.avgPct)}%`}</b> · {s.attempts} ta natija
            </div>
          </button>
        ))}
      </div>

      {empty.length > 0 && (
        <div className="text-[12px] text-ink-faint">
          <button type="button" className="font-bold underline-offset-2 hover:underline" onClick={() => setShowEmpty((x) => !x)}>
            Bo&apos;sh guruhlar ({empty.length}) {showEmpty ? '▲' : '▼'}
          </button>
          {showEmpty && (
            <div className="mt-2 flex flex-wrap gap-2">
              {empty.map((s) => (
                <span key={s.group.chatId} className="rounded-lg border border-line px-2.5 py-1">
                  {s.group.title}
                </span>
              ))}
              <span className="w-full">Bu guruhlarda bot hali o&apos;quvchi ko&apos;rmagan va mock biriktirilmagan.</span>
            </div>
          )}
        </div>
      )}
    </>
  )
}

/* ================================= GROUP ================================= */

type StudentSort = 'name' | 'done' | 'avg' | 'last'

function GroupView({ model, chat, open }: { model: BotModel; chat: number; open: Open }) {
  const s = useMemo(() => model.groupSummary(chat), [model, chat])
  const [sort, setSort] = useState<StudentSort>('done')
  const [q, setQ] = useState('')
  const mocks = useMemo(
    () =>
      model.assigned(chat).map((a) => {
        const m = model.mock(a.code, chat)
        return { a, m, test: model.test.get(a.code) }
      }),
    [model, chat],
  )
  const students = useMemo(() => model.members(chat).map((tg) => model.studentInGroup(tg, chat)), [model, chat])
  const sorted = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = students.filter((x) => !ql || model.name(x.tg).toLowerCase().includes(ql))
    const by: Record<StudentSort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      name: (a, b) => model.name(a.tg).localeCompare(model.name(b.tg)),
      done: (a, b) => b.done - a.done || (b.avgPct ?? -1) - (a.avgPct ?? -1),
      avg: (a, b) => (b.avgScaled ?? -1) - (a.avgScaled ?? -1) || (b.avgPct ?? -1) - (a.avgPct ?? -1),
      last: (a, b) => (b.last ?? '').localeCompare(a.last ?? ''),
    }
    return [...list].sort(by[sort])
  }, [students, sort, q, model])
  const hard = useMemo(() => model.hardQuestions(chat).slice(0, 8), [model, chat])

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-extrabold tracking-tight text-ink">{s.group.title}</h2>
          <p className="text-[12px] text-ink-faint">
            {s.group.slug ? `${s.group.slug.toUpperCase()} kursi guruhi · ` : ''}Telegram ID {s.group.chatId}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="O'quvchilar" value={s.members} sub={`${s.active7} tasi shu hafta faol`} />
        <Tile label="Biriktirilgan mocklar" value={s.assigned} sub={`${s.attempts} ta natija yuborilgan`} />
        <Tile label="Bajarilish" value={s.completion == null ? '—' : `${Math.round(s.completion)}%`} sub="hamma vazifa × hamma o'quvchi" />
        <Tile label="O'rtacha natija" value={s.avgPct == null ? '—' : `${Math.round(s.avgPct)}%`} sub={`oxirgi: ${ago(s.last, model.now)}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* assigned mocks */}
        <Card title={`Biriktirilgan mocklar (${mocks.length})`} hint="Bosib, kim qancha olganini ko'ring">
          {mocks.length === 0 ? (
            <Empty>Bu guruhga botda hali mock biriktirilmagan.</Empty>
          ) : (
            <div className="-mx-1 max-h-[640px] space-y-1 overflow-y-auto px-1">
              {mocks.map(({ a, m, test }) => {
                const done = m.rows.length
                const total = done + m.notSolved.length
                return (
                  <button
                    key={a.code}
                    type="button"
                    onClick={() => open({ k: 'mock', code: a.code, chat })}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left hover:border-line hover:bg-bg-deep"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-bold text-ink">{test?.name ?? `Test ${a.code}`}</span>
                        <KindBadge kind={test?.kind} />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="w-full max-w-[160px]">
                          <Bar value={total ? (100 * done) / total : 0} />
                        </div>
                        <span className="whitespace-nowrap text-[11px] tabular-nums text-ink-faint">
                          {done}/{total} yechgan · kod {a.code} · {dateOnly(a.at)}
                        </span>
                      </div>
                    </div>
                    <div className="w-14 text-right">
                      <div className="text-[14px] font-black tabular-nums text-ink">
                        {m.avgScaled != null ? Math.round(m.avgScaled) : m.avgPct != null ? `${Math.round(m.avgPct)}%` : '—'}
                      </div>
                      <div className="text-[10px] font-semibold text-ink-faint">o&apos;rtacha</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        {/* students */}
        <Card
          title={`O'quvchilar (${students.length})`}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={q} onChange={setQ} placeholder="Ism..." />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as StudentSort)}
                className="rounded-lg border border-line bg-white px-2 py-1.5 text-[12px] font-semibold"
              >
                <option value="done">Bajargani bo&apos;yicha</option>
                <option value="avg">Bali bo&apos;yicha</option>
                <option value="last">Oxirgi faollik</option>
                <option value="name">Ism (A–Z)</option>
              </select>
            </div>
          }
        >
          {sorted.length === 0 ? (
            <Empty>{students.length ? 'Topilmadi.' : "Bot bu guruhda hali o'quvchi ko'rmagan."}</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[12.5px]">
                <thead className="text-[10.5px] font-extrabold uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-2 py-2">O&apos;quvchi</th>
                    <th className="px-2 py-2">Bajargan</th>
                    <th className="px-2 py-2 text-right">O&apos;rtacha</th>
                    <th className="px-2 py-2" title="Har hafta nechta natija yuborgani (oxirgi 8 hafta)">
                      8 hafta
                    </th>
                    <th className="px-2 py-2 text-right">Oxirgi</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((x) => (
                    <tr
                      key={x.tg}
                      onClick={() => open({ k: 'student', tg: x.tg, chat })}
                      className="cursor-pointer border-t border-line hover:bg-bg-deep"
                    >
                      <td className="max-w-[200px] truncate px-2 py-2 font-bold text-ink">{model.name(x.tg)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16">
                            <Bar value={x.assigned ? (100 * x.done) / x.assigned : 0} />
                          </div>
                          <span className="tabular-nums text-ink-soft">
                            {x.done}/{x.assigned}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-black tabular-nums text-ink">
                        {x.avgScaled != null ? Math.round(x.avgScaled) : x.avgPct != null ? `${Math.round(x.avgPct)}%` : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <Spark values={x.weeks} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-ink-soft">{ago(x.last, model.now)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="Bu guruhda eng ko'p xato qilinayotgan savollar" hint="Har mockda kamida 5 kishi yechgan savollar">
        <HardList model={model} rows={hard} open={open} chat={chat} />
      </Card>
    </>
  )
}

/* ================================= MOCK ================================= */

function MockView({ model, code, chat, open, headers }: { model: BotModel; code: string; chat: number | null; open: Open; headers?: Record<string, string> }) {
  const [scope, setScope] = useState<number | null>(chat)
  const m = useMemo(() => model.mock(code, scope), [model, code, scope])
  const test = m.test
  const sat = isSatMock(test)
  const groups = model.groupsOfTest(code)
  const [answers, setAnswers] = useState<BotAnswersData | null>(null)
  const [sel, setSel] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/admin/bot-analytics?answers=${encodeURIComponent(code)}`, { headers })
      .then((r) => (r.ok ? r.json() : {}))
      .then(setAnswers)
      .catch(() => setAnswers({}))
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps
  const topWrong = useMemo(() => (answers ? topWrongAnswers(test, m.rows.map((r) => r.attempt), answers) : null), [answers, test, m.rows])
  const hardest = [...m.questions].filter((q) => q.wrong > 0).sort((a, b) => b.wrongPct - a.wrongPct || a.no - b.no).slice(0, 10)
  const total = m.rows.length + m.notSolved.length
  const selQ = sel != null ? m.questions.find((q) => q.no === sel) : null

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[20px] font-extrabold tracking-tight text-ink">{test?.name ?? `Test ${code}`}</h2>
            <KindBadge kind={test?.kind} />
          </div>
          <p className="text-[12px] text-ink-faint">
            Kod <b className="font-mono text-ink-soft">{code}</b> · {test?.count ?? '?'} ta savol · yaratilgan {dateOnly(test?.createdAt ?? null)}
            {test?.origin === 'site' ? ' · saytdan' : ''}
          </p>
        </div>
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
          Kimlar:
          <select
            value={scope ?? ''}
            onChange={(e) => setScope(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] font-bold text-ink"
          >
            <option value="">Hamma yechganlar</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {model.group.get(g)?.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Yechgan" value={scope == null ? m.rows.length : `${m.rows.length} / ${total}`} sub={scope == null ? "o'quvchi" : `${m.notSolved.length} kishi hali yechmagan`} />
        <Tile label="O'rtacha" value={sat ? fmtScore(m.avgScaled) : fmtPct(m.avgPct)} sub={sat ? `${fmtPct(m.avgPct)} to'g'ri` : "to'g'ri javoblar"} />
        <Tile label="Mediana" value={fmtPct(m.medianPct)} sub="o'rtadagi o'quvchi" />
        <Tile label="Eng yuqori" value={sat ? fmtScore(m.bestScaled) : fmtPct(m.rows[0]?.pct ?? null)} sub={m.rows[0] ? model.name(m.rows[0].tg) : '—'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title={`Natijalar reytingi (${m.rows.length})`} hint="Har o'quvchining birinchi urinishi">
          {m.rows.length === 0 ? (
            <Empty>Hali hech kim yechmagan.</Empty>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[480px] text-left text-[12.5px]">
                <thead className="sticky top-0 bg-white text-[10.5px] font-extrabold uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">O&apos;quvchi</th>
                    <th className="px-2 py-2">Natija</th>
                    <th className="px-2 py-2 text-right">{sat ? 'Ball' : '%'}</th>
                    <th className="px-2 py-2 text-right">Yuborgan</th>
                  </tr>
                </thead>
                <tbody>
                  {m.rows.map((r) => (
                    <tr
                      key={r.tg}
                      onClick={() => open({ k: 'student', tg: r.tg, chat: scope })}
                      className="cursor-pointer border-t border-line hover:bg-bg-deep"
                    >
                      <td className="px-2 py-2 tabular-nums text-ink-faint">
                        {r.rank <= 3 ? <Trophy size={13} className={['text-amber-500', 'text-slate-400', 'text-orange-700'][r.rank - 1]} /> : r.rank}
                      </td>
                      <td className="max-w-[190px] px-2 py-2">
                        <div className="truncate font-bold text-ink">{model.name(r.tg)}</div>
                        {(r.tries > 1 || r.elsewhere) && (
                          <div className="text-[10.5px] text-ink-faint">
                            {r.tries > 1 ? `${r.tries} marta yuborgan` : ''}
                            {r.tries > 1 && r.elsewhere ? ' · ' : ''}
                            {r.elsewhere ? 'boshqa guruhdan' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <Bar value={r.pct} />
                          </div>
                          <span className="tabular-nums text-ink-soft">
                            {r.attempt.c}/{r.attempt.t}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-black tabular-nums text-ink">{sat && r.scaled != null ? r.scaled : `${Math.round(r.pct)}%`}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-ink-soft">{dateTime(r.attempt.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {m.notSolved.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 text-[12px] font-extrabold text-ink">Hali yechmaganlar ({m.notSolved.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {[...m.notSolved]
                  .sort((a, b) => model.name(a).localeCompare(model.name(b)))
                  .map((tg) => (
                    <button
                      key={tg}
                      type="button"
                      onClick={() => open({ k: 'student', tg, chat: scope })}
                      className="rounded-full border border-line px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft hover:border-green hover:text-ink"
                    >
                      {model.name(tg)}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Ballar taqsimoti" hint={sat ? '800 lik shkala' : "to'g'ri javoblar %"}>
            <Histogram model={model} m={m} sat={sat} />
          </Card>
          <Card title="Savollar xaritasi" hint="Rang qancha to'q bo'lsa, shuncha ko'p xato. Savolni bosing.">
            {m.questions.length === 0 || m.rows.length === 0 ? (
              <Empty>Ma&apos;lumot yo&apos;q.</Empty>
            ) : (
              <>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(38px,1fr))] gap-1">
                  {m.questions.map((q) => (
                    <button
                      key={q.no}
                      type="button"
                      onClick={() => setSel(sel === q.no ? null : q.no)}
                      title={`${q.no}-savol: ${Math.round(q.wrongPct)}% xato (${q.wrong}/${q.n})`}
                      className={`h-9 rounded-md text-[11.5px] font-extrabold tabular-nums transition-transform hover:scale-105 ${
                        sel === q.no ? 'ring-2 ring-ink ring-offset-1' : ''
                      }`}
                      style={heat(q.wrongPct)}
                    >
                      {q.no}
                    </button>
                  ))}
                </div>
                <HeatLegend />
                {selQ && (
                  <div className="mt-3 rounded-xl bg-bg-deep px-3 py-2.5 text-[12.5px]">
                    <b>{selQ.no}-savol</b> · {selQ.wrong} / {selQ.n} kishi xato qildi ({Math.round(selQ.wrongPct)}%) · to&apos;g&apos;ri javob{' '}
                    <b className="font-mono">{selQ.key || '—'}</b>
                    {topWrong?.get(selQ.no)?.answer ? (
                      <>
                        {' '}
                        · ko&apos;pchilik belgilagan xato: <b className="font-mono">{topWrong.get(selQ.no)!.answer}</b> ({topWrong.get(selQ.no)!.count} kishi)
                      </>
                    ) : null}
                    {topWrong?.get(selQ.no)?.blank ? ` · ${topWrong.get(selQ.no)!.blank} kishi bo'sh qoldirgan` : ''}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>

      <Card title="Eng ko'p xato qilingan 10 ta savol" hint={answers ? undefined : 'xato javoblar yuklanmoqda...'}>
        {hardest.length === 0 ? (
          <Empty>Xato yo&apos;q yoki hali hech kim yechmagan.</Empty>
        ) : (
          <div className="space-y-1.5">
            {hardest.map((q) => {
              const tw = topWrong?.get(q.no)
              return (
                <div key={q.no} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 text-[12.5px] sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,300px)]">
                  <span className="whitespace-nowrap font-extrabold text-ink">{q.no}-savol</span>
                  <div className="flex items-center gap-2">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-bg-deep">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(2, q.wrongPct)}%`, background: 'var(--heat-strong, #d64545)' }} />
                    </div>
                    <span className="w-24 text-right tabular-nums text-ink-soft">
                      <b className="text-ink">{Math.round(q.wrongPct)}%</b> ({q.wrong}/{q.n})
                    </span>
                  </div>
                  <span className="col-start-2 truncate text-[11.5px] text-ink-faint sm:col-start-auto">
                    to&apos;g&apos;ri: <b className="font-mono text-green-deep">{q.key || '—'}</b>
                    {tw?.answer ? (
                      <>
                        {' '}
                        · ko&apos;p belgilangan: <b className="font-mono text-red-600">{tw.answer}</b>
                      </>
                    ) : null}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        {hardest.some((q) => q.wrongPct >= 80 && q.n >= 8) && (
          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] font-semibold text-amber-700">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            80% dan ko&apos;pi xato qilgan savol bor — javob kalitini tekshirib ko&apos;ring (Bot ↔ Sayt bo&apos;limida &quot;shubhali kalitlar&quot; ham bor).
          </p>
        )}
      </Card>
    </>
  )
}

function Histogram({ model, m, sat }: { model: BotModel; m: MockStats; sat: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const bins = sat
    ? Array.from({ length: 12 }, (_, i) => ({ lo: 200 + i * 50, hi: 250 + i * 50, label: String(200 + i * 50) }))
    : Array.from({ length: 10 }, (_, i) => ({ lo: i * 10, hi: (i + 1) * 10, label: `${i * 10}` }))
  const counts = bins.map((b, i) =>
    m.rows.filter((r) => {
      const v = sat ? (r.scaled ?? 0) : r.pct
      return v >= b.lo && (v < b.hi || i === bins.length - 1)
    }),
  )
  const max = Math.max(1, ...counts.map((c) => c.length))
  if (!m.rows.length) return <Empty>Ma&apos;lumot yo&apos;q.</Empty>
  const h = hover != null ? counts[hover] : null
  return (
    <div>
      <div className="mb-2 h-4 text-[11.5px] text-ink-soft">
        {h && hover != null ? (
          <>
            <b className="text-ink">
              {bins[hover].lo}
              {sat ? '' : '%'}–{hover === bins.length - 1 ? (sat ? 800 : '100%') : `${bins[hover].hi - (sat ? 10 : 1)}${sat ? '' : '%'}`}
            </b>{' '}
            · {h.length} kishi{h.length ? `: ${h.slice(0, 4).map((r) => model.name(r.tg)).join(', ')}${h.length > 4 ? '…' : ''}` : ''}
          </>
        ) : (
          'Ustuncha ustiga olib boring'
        )}
      </div>
      <div className="flex h-[120px] items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {counts.map((c, i) => (
          <div key={i} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div
              className="w-full rounded-t-[4px] transition-opacity"
              style={{
                height: c.length ? `${(100 * c.length) / max}%` : '2px',
                background: c.length ? 'var(--green)' : 'var(--line)',
                opacity: hover == null || hover === i ? 1 : 0.45,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[9.5px] tabular-nums text-ink-faint">
        {bins.map((b, i) => (
          <span key={i} className="flex-1 text-center">
            {i % 2 === 0 ? b.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ================================= STUDENT ================================= */

function StudentView({ model, tg, chat, open }: { model: BotModel; tg: number; chat: number | null; open: Open }) {
  const p = useMemo(() => model.student(tg), [model, tg])
  const user = model.username(tg)
  const ctx = chat ?? (p.groups.length === 1 ? p.groups[0] : null)
  const tasks = useMemo(() => {
    if (ctx == null) return null
    // not done first (that's what he needs to chase), then done — newest assignment first in both
    return model
      .assigned(ctx)
      .map((a) => {
        const mine = (model.byStudent.get(tg) ?? []).filter((x) => x.code === a.code)
        return { a, first: mine[0] ?? null, tries: mine.length }
      })
      .sort((x, y) => Number(!!x.first) - Number(!!y.first))
  }, [model, ctx, tg])
  const doneN = tasks?.filter((t) => t.first).length ?? 0
  const [allTasks, setAllTasks] = useState(false)
  const rhythm =
    p.medianGapDays == null ? '—' : p.medianGapDays <= 1 ? 'har kuni' : `har ${Math.round(p.medianGapDays)} kunda`

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-extrabold tracking-tight text-ink">{model.name(tg)}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-faint">
            {user ? (
              <a href={`https://t.me/${user}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-green-deep hover:underline">
                @{user} <ExternalLink size={11} />
              </a>
            ) : (
              <span>username yo&apos;q</span>
            )}
            <span>· ID {tg}</span>
            {p.groups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => open({ k: 'group', chat: g })}
                className="rounded-full border border-line px-2 py-0.5 font-semibold text-ink-soft hover:border-green"
              >
                {model.group.get(g)?.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Yuborgan natijalar" value={p.attempts.length} sub={`${p.tests} xil test · ${p.activeDays30} kun faol (30 kun)`} />
        <Tile label="Qanchalik tez-tez" value={rhythm} sub={`oxirgi: ${ago(p.last, model.now)}`} />
        <Tile label="O'rtacha (SAT mock)" value={fmtScore(p.avgScaled)} sub={`hamma testlar: ${fmtPct(p.avgPct)}`} />
        <Tile label="Eng yuqori" value={fmtScore(p.bestScaled)} sub={`birinchi natija: ${dateOnly(p.first)}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="SAT mock ballari o'sishi" hint="Har mockning birinchi urinishi, vaqt bo'yicha">
          <TrendChart model={model} points={p.trend} />
        </Card>
        <Card title="Haftalik faollik" hint="Oxirgi 12 hafta, nechta natija yuborgan">
          <WeekBars weeks={p.weeks} />
        </Card>
      </div>

      {tasks && ctx != null && (
        <Card title={`${model.group.get(ctx)?.title} vazifalari: ${doneN} / ${tasks.length} bajarilgan`}>
          {tasks.length === 0 ? (
            <Empty>Bu guruhga mock biriktirilmagan.</Empty>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {tasks.slice(0, allTasks ? undefined : tasks.length - doneN + 6).map(({ a, first, tries }) => (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => open({ k: 'mock', code: a.code, chat: ctx })}
                  className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[12.5px] hover:border-green ${
                    first ? 'border-line' : 'border-dashed border-red-400/60'
                  }`}
                >
                  {first ? <Check size={15} className="shrink-0 text-green" /> : <X size={15} className="shrink-0 text-red-500" />}
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{model.testName(a.code)}</span>
                  <span className="whitespace-nowrap text-[11.5px] tabular-nums text-ink-soft">
                    {first ? (
                      <>
                        <b className="text-ink">{scoreOf(first)}</b> · {dateOnly(first.at)}
                        {tries > 1 ? ` · ×${tries}` : ''}
                      </>
                    ) : (
                      <span className="font-bold text-red-600">bajarmagan</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!allTasks && doneN > 6 && (
            <button type="button" className="adm-btn mt-3" onClick={() => setAllTasks(true)}>
              Bajarilganlarning hammasini ko&apos;rsatish ({doneN - 6} ta yana)
            </button>
          )}
        </Card>
      )}

      <Card title={`Barcha yuborgan natijalari (${p.attempts.length})`}>
        {p.attempts.length === 0 ? (
          <Empty>Bu o&apos;quvchi hali natija yubormagan.</Empty>
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[560px] text-left text-[12.5px]">
              <thead className="sticky top-0 bg-white text-[10.5px] font-extrabold uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-2 py-2">Qachon</th>
                  <th className="px-2 py-2">Test</th>
                  <th className="px-2 py-2">To&apos;g&apos;ri</th>
                  <th className="px-2 py-2 text-right">Natija</th>
                  <th className="px-2 py-2">Guruh</th>
                </tr>
              </thead>
              <tbody>
                {p.attempts.map((a, i) => {
                  const gap = i < p.attempts.length - 1 ? Math.round((Date.parse(a.at) - Date.parse(p.attempts[i + 1].at)) / 86_400_000) : null
                  return (
                    <tr key={a.id} onClick={() => open({ k: 'mock', code: a.code, chat: a.chat ?? ctx })} className="cursor-pointer border-t border-line hover:bg-bg-deep">
                      <td className="whitespace-nowrap px-2 py-2 text-ink-soft">
                        {dateTime(a.at)}
                        {gap != null && gap >= 1 && <span className="ml-1.5 text-[10.5px] text-ink-faint">+{gap} kun</span>}
                      </td>
                      <td className="max-w-[240px] truncate px-2 py-2 font-semibold text-ink">{model.testName(a.code)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16">
                            <Bar value={(100 * a.c) / (a.t || 1)} />
                          </div>
                          <span className="tabular-nums text-ink-soft">
                            {a.c}/{a.t}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-black tabular-nums text-ink">{scoreOf(a)}</td>
                      <td className="max-w-[150px] truncate px-2 py-2 text-[11.5px] text-ink-faint">
                        {a.chat != null ? model.group.get(a.chat)?.title ?? '—' : 'shaxsiy'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

function TrendChart({ model, points }: { model: BotModel; points: { at: string; value: number; code: string }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length === 0) return <Empty>Hali SAT mock (800 lik) yechmagan.</Empty>
  const W = 600
  const H = 200
  const L = 34
  const R = 10
  const T = 12
  const B = 24
  const lo = Math.max(200, Math.floor((Math.min(...points.map((p) => p.value)) - 40) / 50) * 50)
  const hi = Math.min(800, Math.ceil((Math.max(...points.map((p) => p.value)) + 20) / 50) * 50)
  const x = (i: number) => (points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1))
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / Math.max(1, hi - lo)
  const ticks = [lo, Math.round((lo + hi) / 2 / 10) * 10, hi]
  const h = hover ?? points.length - 1
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const first = points[0].value
  const lastV = points[points.length - 1].value
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-[11.5px] text-ink-soft">
        <span>
          <b className="text-ink">{points[h].value}</b> · {model.testName(points[h].code)} · {dateOnly(points[h].at)}
        </span>
        {points.length > 1 && (
          <span className={`font-bold ${lastV > first ? 'text-green-deep' : lastV < first ? 'text-red-600' : 'text-ink-soft'}`}>
            {lastV === first ? "birinchi va oxirgi natija bir xil" : `${lastV > first ? '▲' : '▼'} ${Math.abs(lastV - first)} ball (birinchi mockdan oxirgisigacha)`}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={L - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-faint)">
              {t}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinejoin="round" />
        <line x1={x(h)} x2={x(h)} y1={T} y2={H - B} stroke="var(--ink-faint)" strokeOpacity="0.35" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={i === h ? 5.5 : 4} fill="var(--green)" stroke="var(--bg)" strokeWidth="2" />
            <rect
              x={x(i) - (W - L - R) / Math.max(2, points.length) / 2}
              y={0}
              width={(W - L - R) / Math.max(2, points.length)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}
        <text x={L} y={H - 6} fontSize="10" fill="var(--ink-faint)">
          {dayMonth(points[0].at)}
        </text>
        {points.length > 1 && (
          <text x={W - R} y={H - 6} fontSize="10" textAnchor="end" fill="var(--ink-faint)">
            {dayMonth(points[points.length - 1].at)}
          </text>
        )}
      </svg>
    </div>
  )
}

function WeekBars({ weeks }: { weeks: { week: number; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...weeks.map((w) => w.count))
  const monday = (w: number) => {
    const d = new Date((w * 7 - 3) * 86_400_000)
    return `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const h = hover ?? weeks.length - 1
  return (
    <div>
      <div className="mb-2 text-[11.5px] text-ink-soft">
        <b className="text-ink">{monday(weeks[h].week)}</b> haftasi · {weeks[h].count} ta natija
      </div>
      <div className="flex h-[150px] items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {weeks.map((w, i) => (
          <div key={w.week} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div
              className="w-full rounded-t-[4px]"
              style={{
                height: w.count ? `${(100 * w.count) / max}%` : '2px',
                background: w.count ? 'var(--green)' : 'var(--line)',
                opacity: hover == null || hover === i ? 1 : 0.45,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[9.5px] tabular-nums text-ink-faint">
        {weeks.map((w, i) => (
          <span key={w.week} className="flex-1 text-center">
            {i % 3 === 0 || i === weeks.length - 1 ? monday(w.week) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ================================= HOME: tests ================================= */

function TestsHome({ model, open }: { model: BotModel; open: Open }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const rows = useMemo(
    () =>
      model.data.tests.map((t) => {
        const m = model.mock(t.code)
        return { t, solved: m.rows.length, avg: isSatMock(t) ? m.avgScaled : null, avgPct: m.avgPct, groups: model.groupsOfTest(t.code) }
      }),
    [model],
  )
  const ql = q.trim().toLowerCase()
  const shown = rows.filter((r) => (!kind || r.t.kind === kind) && (!ql || `${r.t.name} ${r.t.code}`.toLowerCase().includes(ql)))
  const kinds = [...new Set(model.data.tests.map((t) => t.kind))]
  return (
    <Card
      title={`Botdagi barcha testlar (${shown.length})`}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={q} onChange={setQ} placeholder="Nomi yoki kodi..." />
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-[12px] font-semibold">
            <option value="">Hamma turlar</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k] ?? k}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[12.5px]">
          <thead className="text-[10.5px] font-extrabold uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-2 py-2">Kod</th>
              <th className="px-2 py-2">Nomi</th>
              <th className="px-2 py-2">Savol</th>
              <th className="px-2 py-2">Guruhlar</th>
              <th className="px-2 py-2 text-right">Yechgan</th>
              <th className="px-2 py-2 text-right">O&apos;rtacha</th>
              <th className="px-2 py-2 text-right">Yaratilgan</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ t, solved, avg, avgPct, groups }) => (
              <tr key={t.code} onClick={() => open({ k: 'mock', code: t.code, chat: null })} className="cursor-pointer border-t border-line hover:bg-bg-deep">
                <td className="px-2 py-2 font-mono font-bold text-ink-soft">{t.code}</td>
                <td className="max-w-[260px] px-2 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-bold text-ink">{t.name}</span>
                    <KindBadge kind={t.kind} />
                  </div>
                </td>
                <td className="px-2 py-2 tabular-nums text-ink-soft">{t.count}</td>
                <td className="max-w-[200px] px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    {groups.length === 0 ? (
                      <span className="text-[11px] text-ink-faint">—</span>
                    ) : (
                      groups.map((g) => (
                        <span key={g} className="truncate rounded-full bg-bg-deep px-2 py-0.5 text-[10.5px] font-semibold text-ink-soft">
                          {model.group.get(g)?.title}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-right font-bold tabular-nums text-ink">{solved}</td>
                <td className="px-2 py-2 text-right font-black tabular-nums text-ink">{avg != null ? Math.round(avg) : avgPct != null ? `${Math.round(avgPct)}%` : '—'}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right text-ink-faint">{dateOnly(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <Empty>Hech narsa topilmadi.</Empty>}
      </div>
    </Card>
  )
}

/* ================================= HOME: hardest questions ================================= */

function HardHome({ model, open }: { model: BotModel; open: Open }) {
  const [chat, setChat] = useState<number | null>(null)
  const [min, setMin] = useState(5)
  const [limit, setLimit] = useState(30)
  const rows = useMemo(() => model.hardQuestions(chat, min), [model, chat, min])
  const live = model.data.groups.filter((g) => model.members(g.chatId).length > 0 || model.assigned(g.chatId).length > 0)
  return (
    <Card
      title="Ko'p xato qilinadigan savollar"
      hint="Hamma mocklar bo'yicha; har o'quvchining birinchi urinishi hisobga olinadi"
      right={
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-ink-soft">
          <select
            value={chat ?? ''}
            onChange={(e) => setChat(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-line bg-white px-2 py-1.5 text-[12px] font-semibold"
          >
            <option value="">Hamma guruhlar</option>
            {live.map((g) => (
              <option key={g.chatId} value={g.chatId}>
                {g.title}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5">
            kamida
            <select value={min} onChange={(e) => setMin(Number(e.target.value))} className="rounded-lg border border-line bg-white px-2 py-1.5 text-[12px] font-semibold">
              {[3, 5, 8, 10, 15].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            kishi yechgan
          </label>
        </div>
      }
    >
      <HardList model={model} rows={rows.slice(0, limit)} open={open} chat={chat} />
      {rows.length > limit && (
        <button type="button" className="adm-btn mt-3" onClick={() => setLimit((l) => l + 30)}>
          Yana ko&apos;rsatish ({rows.length - limit})
        </button>
      )}
    </Card>
  )
}

function HardList({ model, rows, open, chat }: { model: BotModel; rows: ReturnType<BotModel['hardQuestions']>; open: Open; chat: number | null }) {
  if (rows.length === 0) return <Empty>Yetarli ma&apos;lumot yo&apos;q.</Empty>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[12.5px]">
        <thead className="text-[10.5px] font-extrabold uppercase tracking-wide text-ink-faint">
          <tr>
            <th className="px-2 py-2">Mock</th>
            <th className="px-2 py-2">Savol</th>
            <th className="px-2 py-2">Xato qilganlar</th>
            <th className="px-2 py-2">To&apos;g&apos;ri javob</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.code}|${r.no}`} onClick={() => open({ k: 'mock', code: r.code, chat })} className="cursor-pointer border-t border-line hover:bg-bg-deep">
              <td className="max-w-[260px] truncate px-2 py-2 font-semibold text-ink">{r.name}</td>
              <td className="px-2 py-2 font-extrabold text-ink">{r.no}</td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-32 overflow-hidden rounded-full bg-bg-deep">
                    <div className="h-full rounded-full" style={{ width: `${r.wrongPct}%`, background: 'var(--heat-strong, #d64545)' }} />
                  </div>
                  <span className="tabular-nums text-ink-soft">
                    <b className="text-ink">{Math.round(r.wrongPct)}%</b> · {r.wrong}/{r.n}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2">
                <span className="font-mono font-bold text-green-deep">{r.key || '—'}</span>
                {r.wrongPct >= 90 && r.n >= 8 && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                    <AlertTriangle size={10} /> kalitni tekshiring
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ================================= HOME: all students ================================= */

function StudentsHome({ model, open }: { model: BotModel; open: Open }) {
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(60)
  const all = useMemo(
    () =>
      [...model.byStudent.keys()]
        .map((tg) => {
          const list = model.byStudent.get(tg)!
          const sc = list.map((a) => /^\s*(\d{3})\s*\/\s*800/.exec(a.s)?.[1]).filter(Boolean).map(Number)
          return { tg, n: list.length, last: list[list.length - 1].at, avg: sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null, groups: model.groupsOf(tg) }
        })
        .sort((a, b) => b.last.localeCompare(a.last)),
    [model],
  )
  const ql = q.trim().toLowerCase()
  const shown = all.filter((s) => !ql || `${model.name(s.tg)} ${model.username(s.tg)} ${s.tg}`.toLowerCase().includes(ql))
  return (
    <Card title={`Natija yuborgan o'quvchilar (${shown.length})`} right={<SearchBox value={q} onChange={setQ} placeholder="Ism, @username yoki ID..." />}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12.5px]">
          <thead className="text-[10.5px] font-extrabold uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-2 py-2">O&apos;quvchi</th>
              <th className="px-2 py-2">Guruh</th>
              <th className="px-2 py-2 text-right">Natijalar</th>
              <th className="px-2 py-2 text-right">O&apos;rtacha (SAT)</th>
              <th className="px-2 py-2 text-right">Oxirgi</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((s) => (
              <tr key={s.tg} onClick={() => open({ k: 'student', tg: s.tg, chat: null })} className="cursor-pointer border-t border-line hover:bg-bg-deep">
                <td className="max-w-[220px] truncate px-2 py-2 font-bold text-ink">{model.name(s.tg)}</td>
                <td className="max-w-[200px] truncate px-2 py-2 text-[11.5px] text-ink-faint">
                  {s.groups.map((g) => model.group.get(g)?.title).join(', ') || '—'}
                </td>
                <td className="px-2 py-2 text-right font-bold tabular-nums text-ink">{s.n}</td>
                <td className="px-2 py-2 text-right font-black tabular-nums text-ink">{s.avg != null ? Math.round(s.avg) : '—'}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right text-ink-soft">{ago(s.last, model.now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length > limit && (
        <button type="button" className="adm-btn mt-3" onClick={() => setLimit((l) => l + 60)}>
          Yana ko&apos;rsatish ({shown.length - limit})
        </button>
      )}
    </Card>
  )
}

function StudentSearch({ model, onPick }: { model: BotModel; onPick: (tg: number) => void }) {
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const ql = q.trim().toLowerCase()
  const hits = useMemo(() => {
    if (ql.length < 2) return []
    const ids = new Set<number>([...model.byStudent.keys(), ...model.data.members.map((m) => m.tg)])
    return [...ids].filter((tg) => `${model.name(tg)} ${model.username(tg)} ${tg}`.toLowerCase().includes(ql)).slice(0, 8)
  }, [model, ql])
  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        placeholder="O'quvchini topish..."
        className="h-9 w-[200px] rounded-[10px] border border-line bg-white pl-8 pr-3 text-[12.5px] focus:border-green focus:outline-none sm:w-[240px]"
      />
      {focus && hits.length > 0 && (
        <div className="absolute right-0 top-10 z-30 w-[280px] overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          {hits.map((tg) => (
            <button
              key={tg}
              type="button"
              onMouseDown={() => {
                onPick(tg)
                setQ('')
              }}
              className="block w-full px-3 py-2 text-left text-[12.5px] hover:bg-bg-deep"
            >
              <div className="truncate font-bold text-ink">{model.name(tg)}</div>
              <div className="truncate text-[11px] text-ink-faint">
                {model.groupsOf(tg).map((g) => model.group.get(g)?.title).join(', ') || 'guruhsiz'} · {model.byStudent.get(tg)?.length ?? 0} ta natija
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ================================= small pieces ================================= */

function Card({ title, hint, right, children }: { title?: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5">
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            {title && <h3 className="text-[13.5px] font-extrabold text-ink">{title}</h3>}
            {hint && <p className="text-[11px] text-ink-faint">{hint}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white px-4 py-3">
      <div className="text-[11px] font-bold text-ink-faint">{label}</div>
      <div className="mt-0.5 text-[22px] font-black leading-tight tracking-tight text-ink tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-ink-soft">{sub}</div>}
    </div>
  )
}

function Mini({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-bg-deep px-1 py-1.5">
      <div className="text-[16px] font-black tabular-nums text-ink">{value}</div>
      <div className="text-[10px] font-semibold text-ink-faint">{label}</div>
    </div>
  )
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-bg-deep">
      <div className="h-full rounded-full bg-green" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex h-5 w-[72px] items-end gap-[2px]" title={values.join(' · ') + ' (haftalar bo‘yicha)'}>
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: v ? `${Math.max(18, (100 * v) / max)}%` : '2px', background: v ? 'var(--green)' : 'var(--line)' }} />
      ))}
    </div>
  )
}

function KindBadge({ kind }: { kind?: string }) {
  if (!kind) return null
  const sat = /_44$/.test(kind)
  return (
    <span className={`shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-extrabold ${sat ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'}`}>
      {sat ? 'MOCK' : 'VAZIFA'}
    </span>
  )
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-[170px] rounded-lg border border-line bg-white py-1.5 pl-7 pr-2 text-[12px] focus:border-green focus:outline-none"
      />
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 py-3 text-[12.5px] text-ink-faint">
      <CalendarClock size={13} /> {children}
    </p>
  )
}

/** Wrong-% → one red hue, light → dark (5 steps), readable text on each. */
function heat(wrongPct: number): React.CSSProperties {
  const step = wrongPct < 10 ? 0 : wrongPct < 25 ? 1 : wrongPct < 45 ? 2 : wrongPct < 65 ? 3 : 4
  const mix = [0, 22, 45, 70, 92][step]
  return {
    background: step === 0 ? 'var(--bg-deep)' : `color-mix(in srgb, #d64545 ${mix}%, var(--bg-deep))`,
    color: step >= 3 ? '#fff' : 'var(--ink)',
  }
}

function HeatLegend() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] text-ink-faint">
      xato:
      {[
        ['<10%', 5],
        ['10–25%', 15],
        ['25–45%', 35],
        ['45–65%', 55],
        ['65%+', 80],
      ].map(([l, v]) => (
        <span key={l as string} className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-[3px]" style={heat(v as number)} />
          {l}
        </span>
      ))}
    </div>
  )
}

const fmtPct = (v: number | null) => (v == null ? '—' : `${Math.round(v)}%`)
const fmtScore = (v: number | null) => (v == null ? '—' : String(Math.round(v)))
const scoreOf = (a: BotAttempt) => {
  const m = /^\s*(\d{3})\s*\/\s*800/.exec(a.s)
  return m ? m[1] : `${Math.round((100 * a.c) / (a.t || 1))}%`
}
