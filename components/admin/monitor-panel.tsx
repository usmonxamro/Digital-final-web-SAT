'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Copy, Loader2, RefreshCw, Search, Users } from 'lucide-react'
import { BotModel, ago, dateTime, type BotAnalyticsData, type BotAttempt } from '@/lib/bot-analytics'

/**
 * Admin «Nazorat»: pick a group → every student in it, when they last sent a mock and which one,
 * how many of the group's mocks they did, and a 14-day activity strip. Built for a quick daily look:
 * who is working, who went quiet.
 */

const DAY = 86_400_000
const TZ = 5 * 3_600_000 // Toshkent
const dayNo = (ms: number) => Math.floor((ms + TZ) / DAY)

type Status = 'today' | 'active' | 'slow' | 'quiet' | 'never'
const STATUS: Record<Status, { label: string; dot: string; ring: string; text: string }> = {
  today: { label: 'Bugun', dot: 'bg-[#16a34a]', ring: 'ring-[#16a34a]/30 bg-[#16a34a]/10 text-[#15803d]', text: 'text-[#15803d]' },
  active: { label: 'Faol', dot: 'bg-emerald-400', ring: 'ring-emerald-300/40 bg-emerald-50 text-emerald-700', text: 'text-emerald-700' },
  slow: { label: 'Sustlashgan', dot: 'bg-amber-400', ring: 'ring-amber-300/50 bg-amber-50 text-amber-700', text: 'text-amber-700' },
  quiet: { label: 'Jim', dot: 'bg-red-400', ring: 'ring-red-300/40 bg-red-50 text-red-600', text: 'text-red-600' },
  never: { label: 'Hech yubormagan', dot: 'bg-slate-300', ring: 'ring-slate-200 bg-slate-50 text-slate-500', text: 'text-slate-500' },
}
const statusOf = (lastMs: number | null, now: number): Status => {
  if (lastMs == null) return 'never'
  const d = dayNo(now) - dayNo(lastMs)
  return d <= 0 ? 'today' : d <= 3 ? 'active' : d <= 7 ? 'slow' : 'quiet'
}

type Row = {
  tg: number
  name: string
  user: string
  last: BotAttempt | null
  status: Status
  done: number
  assigned: number
  days: boolean[]
  recent: BotAttempt[]
}

export function MonitorPanel() {
  const [data, setData] = useState<BotAnalyticsData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [chat, setChat] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [sort, setSort] = useState<'quiet' | 'recent' | 'name' | 'done'>('quiet')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  function load() {
    setLoading(true)
    setErr(null)
    fetch('/api/admin/bot-analytics', { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Xatolik')
        setData(d.missing ? null : d)
        if (d.missing) setErr('Bot jadvallari Supabase’da topilmadi.')
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Server bilan bog‘lanib bo‘lmadi.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const model = useMemo(() => (data ? new BotModel(data) : null), [data])

  // Groups, the most recently active first.
  const groups = useMemo(() => {
    if (!model) return []
    return model.data.groups
      .map((g) => {
        const s = model.groupSummary(g.chatId)
        const today = model.data.attempts.filter((a) => model.inGroup(a, g.chatId) && dayNo(Date.parse(a.at)) === dayNo(model.now)).length
        return { g, s, today }
      })
      .filter((x) => x.s.members > 0)
      .sort((a, b) => (b.s.last ?? '').localeCompare(a.s.last ?? ''))
  }, [model])

  useEffect(() => {
    if (chat == null && groups.length) setChat(groups[0].g.chatId)
  }, [groups, chat])

  const rows = useMemo<Row[]>(() => {
    if (!model || chat == null) return []
    const today = dayNo(model.now)
    return model.members(chat).map((tg) => {
      const all = model.byStudent.get(tg) ?? []
      const last = all.length ? all[all.length - 1] : null
      const sig = model.studentInGroup(tg, chat)
      const days = Array.from({ length: 14 }, () => false)
      for (const a of all) {
        const i = 13 - (today - dayNo(Date.parse(a.at)))
        if (i >= 0 && i < 14) days[i] = true
      }
      return {
        tg,
        name: model.name(tg),
        user: model.username(tg),
        last,
        status: statusOf(last ? Date.parse(last.at) : null, model.now),
        done: sig.done,
        assigned: sig.assigned,
        days,
        recent: all.slice(-6).reverse(),
      }
    })
  }, [model, chat])

  const counts = useMemo(() => {
    const c: Record<Status, number> = { today: 0, active: 0, slow: 0, quiet: 0, never: 0 }
    for (const r of rows) c[r.status]++
    return c
  }, [rows])

  const shown = useMemo(() => {
    const w = q.trim().toLowerCase()
    const list = rows.filter((r) => (filter === 'all' || r.status === filter) && (!w || `${r.name} ${r.user}`.toLowerCase().includes(w)))
    const t = (r: Row) => (r.last ? Date.parse(r.last.at) : 0)
    return list.sort((a, b) =>
      sort === 'quiet' ? t(a) - t(b) : sort === 'recent' ? t(b) - t(a) : sort === 'done' ? b.done / (b.assigned || 1) - a.done / (a.assigned || 1) : a.name.localeCompare(b.name),
    )
  }, [rows, filter, sort, q])

  if (!model)
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-[13px]">
        {err ? (
          <span className="flex items-center gap-3 font-semibold text-red-600">
            {err}
            <button type="button" className="adm-btn" onClick={load}>
              <RefreshCw size={14} /> Qayta
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-ink-faint">
            <Loader2 size={15} className="animate-spin" /> O‘quvchilar yuklanmoqda...
          </span>
        )}
      </div>
    )

  const cur = groups.find((x) => x.g.chatId === chat)
  const quietList = rows.filter((r) => r.status === 'quiet' || r.status === 'never' || r.status === 'slow')

  return (
    <div className="min-w-0 space-y-4">
      {/* group picker */}
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {groups.map(({ g, s, today }) => {
          const on = g.chatId === chat
          return (
            <button
              key={g.chatId}
              type="button"
              onClick={() => {
                setChat(g.chatId)
                setOpen(null)
              }}
              className={`min-w-[190px] shrink-0 rounded-2xl border p-3 text-left transition ${
                on ? 'border-green bg-green-mist/60 shadow-[0_6px_24px_rgba(22,163,74,.12)]' : 'border-line bg-white hover:border-ink-faint'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${today ? 'bg-[#16a34a]' : s.active7 ? 'bg-amber-400' : 'bg-slate-300'}`} />
                <b className="truncate text-[13px] text-ink">{g.title}</b>
              </div>
              <p className="mt-1 text-[11.5px] text-ink-soft">
                {s.members} o‘quvchi · 7 kunda {s.active7} faol
              </p>
              <p className="text-[11px] text-ink-faint">{today ? `Bugun ${today} ta natija` : `Oxirgi: ${ago(s.last, model.now)}`}</p>
            </button>
          )
        })}
        <button type="button" className="adm-btn !h-auto shrink-0 self-stretch" onClick={load} title="Yangilash" disabled={loading}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
        </button>
      </div>

      {cur && (
        <>
          {/* status tiles = filters */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Tile on={filter === 'all'} onClick={() => setFilter('all')} n={rows.length} label="Hammasi" dot="bg-ink" />
            {(Object.keys(STATUS) as Status[]).map((k) => (
              <Tile key={k} on={filter === k} onClick={() => setFilter(filter === k ? 'all' : k)} n={counts[k]} label={STATUS[k].label} dot={STATUS[k].dot} hint={hintOf(k)} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[200px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki @username" className="adm-input w-full !pl-8" />
            </label>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="adm-input !w-auto">
              <option value="quiet">Eng uzoq jim turganlar</option>
              <option value="recent">Eng so‘nggi yuborganlar</option>
              <option value="done">Ko‘p bajarganlar</option>
              <option value="name">Ism bo‘yicha</option>
            </select>
            {quietList.length > 0 && (
              <button
                type="button"
                className="adm-btn"
                title="Sustlashgan, jim va hech yubormaganlarni Telegram uchun nusxalash"
                onClick={() => {
                  const txt = quietList.map((r) => (r.user ? `@${r.user}` : r.name)).join(' ')
                  navigator.clipboard?.writeText(txt).catch(() => {})
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} Faol bo‘lmaganlar ({quietList.length})
              </button>
            )}
          </div>

          {/* students */}
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,2.4fr)_110px_150px_24px] gap-3 border-b border-line bg-bg-deep/50 px-4 py-2 text-[10.5px] font-extrabold uppercase tracking-wide text-ink-faint md:grid">
              <span>O‘quvchi</span>
              <span>Oxirgi yuborgan mock</span>
              <span>Bajargan</span>
              <span>So‘nggi 14 kun</span>
              <span />
            </div>
            {shown.length === 0 && <p className="px-4 py-8 text-center text-[12.5px] text-ink-faint">Hech kim topilmadi.</p>}
            {shown.map((r) => {
              const st = STATUS[r.status]
              const isOpen = open === r.tg
              return (
                <div key={r.tg} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : r.tg)}
                    className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition hover:bg-bg-deep/40 md:grid-cols-[minmax(0,2.2fr)_minmax(0,2.4fr)_110px_150px_24px] md:items-center md:gap-3"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={`relative flex size-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-extrabold ring-2 ${st.ring}`}>
                        {initials(r.name)}
                        <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white ${st.dot}`} />
                      </span>
                      <span className="min-w-0">
                        <b className="block truncate text-[13.5px] text-ink">{r.name}</b>
                        <span className="block truncate text-[11.5px] text-ink-faint">{r.user ? `@${r.user}` : `ID ${r.tg}`}</span>
                      </span>
                    </span>
                    <span className="min-w-0">
                      {r.last ? (
                        <>
                          <span className="block truncate text-[13px] font-bold text-ink">{model.testName(r.last.code)}</span>
                          <span className="block text-[11.5px] text-ink-soft">
                            <span className={`font-bold ${st.text}`}>{agoExact(r.last.at, model.now)}</span> · {dateTime(r.last.at)} · {r.last.s || `${r.last.c}/${r.last.t}`}
                          </span>
                        </>
                      ) : (
                        <span className="text-[12.5px] font-semibold text-slate-500">Hali birorta mock yubormagan</span>
                      )}
                    </span>
                    <span>
                      <span className="text-[12.5px] font-extrabold tabular-nums text-ink">
                        {r.done}
                        <span className="font-semibold text-ink-faint">/{r.assigned}</span>
                      </span>
                      <span className="mt-1 block h-1.5 w-20 overflow-hidden rounded-full bg-bg-deep">
                        <span className="block h-full rounded-full bg-green" style={{ width: `${r.assigned ? (100 * r.done) / r.assigned : 0}%` }} />
                      </span>
                    </span>
                    <span className="flex items-center gap-[3px]" title="So‘nggi 14 kun: to‘ldirilgan — o‘sha kuni natija yuborgan">
                      {r.days.map((on, i) => (
                        <span key={i} className={`h-4 w-[7px] rounded-[2px] ${on ? 'bg-green' : 'bg-bg-deep'} ${i === 13 ? 'outline outline-1 outline-offset-1 outline-ink-faint/40' : ''}`} />
                      ))}
                    </span>
                    <ChevronDown size={15} className={`hidden text-ink-faint transition md:block ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="bg-bg-deep/40 px-4 pb-3 pt-1 md:pl-16">
                      <p className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-ink-faint">So‘nggi yuborganlari</p>
                      {r.recent.length === 0 ? (
                        <p className="text-[12px] text-ink-faint">Natija yo‘q.</p>
                      ) : (
                        <ul className="space-y-1">
                          {r.recent.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                              <span className="w-28 shrink-0 tabular-nums text-ink-faint">{dateTime(a.at)}</span>
                              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{model.testName(a.code)}</span>
                              <span className="font-bold tabular-nums text-ink">{a.s || `${a.c}/${a.t}`}</span>
                              {!model.isAssigned(chat!, a.code) && <span className="text-[10.5px] text-ink-faint">(boshqa guruh testi)</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {r.assigned > r.done && (
                        <p className="mt-2 text-[12px] text-ink-soft">
                          <b className="text-ink">Bajarmagan:</b>{' '}
                          {model
                            .assigned(chat!)
                            .filter((x) => !model.solved(r.tg, x.code))
                            .slice(0, 8)
                            .map((x) => model.testName(x.code))
                            .join(', ')}
                          {r.assigned - r.done > 8 ? ' …' : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-ink-faint">
            <Users size={12} /> Ma’lumot {dateTime(model.data.generatedAt)} holatida · bot natijalarni har 5 daqiqada yuboradi
          </p>
        </>
      )}
    </div>
  )
}

function Tile({ on, onClick, n, label, dot, hint }: { on: boolean; onClick: () => void; n: number; label: string; dot: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`rounded-2xl border p-3 text-left transition ${on ? 'border-ink bg-white shadow-sm' : 'border-line bg-white hover:border-ink-faint'}`}
    >
      <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-ink-soft">
        <span className={`size-2 rounded-full ${dot}`} /> {label}
      </span>
      <b className="mt-0.5 block text-[22px] leading-tight tabular-nums text-ink">{n}</b>
    </button>
  )
}

const hintOf = (s: Status) =>
  s === 'today' ? 'Bugun natija yuborgan' : s === 'active' ? '1–3 kun ichida' : s === 'slow' ? '4–7 kun yubormagan' : s === 'quiet' ? '7 kundan ko‘p yubormagan' : 'Birorta ham natija yo‘q'

function initials(name: string) {
  const p = name.replace(/^@/, '').split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] ?? '?') + (p[1]?.[0] ?? '')).toUpperCase()
}

/** "35 daqiqa oldin", "3 soat oldin", then the day-level wording. */
function agoExact(iso: string, now: number) {
  const m = Math.round((now - Date.parse(iso)) / 60000)
  if (m < 1) return 'hozirgina'
  if (m < 60) return `${m} daqiqa oldin`
  if (m < 24 * 60 && dayNo(Date.parse(iso)) === dayNo(now)) return `${Math.round(m / 60)} soat oldin`
  return ago(iso, now)
}
