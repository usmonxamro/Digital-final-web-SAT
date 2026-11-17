'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  GripVertical,
  History,
  Layers,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShoppingBasket,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { QuestionCard } from '@/components/admin/question-card'
import { basket, useBasket } from '@/components/admin/review-basket'
import type { Question } from '@/lib/test-data'
import type { Twin } from '@/lib/twins'

/* ------------------------------------------------------------------ types */

type PoolQ = Question & { kind: 'reading' | 'math'; testLabel?: string }
type UsedIn = { label: string; at: string | null }
type PoolItem = {
  family: string
  question: PoolQ
  misses?: number
  seen?: number
  rate?: number
  lastAt?: string | null
  labels?: string[]
  students?: number
  twins: Twin[]
  usedIn?: UsedIn[]
}
/** One block on the canvas: a question family + which version goes into the mock. */
type Block = { uid: string; family: string; question: PoolQ; twins: Twin[]; pick: 'orig' | string; misses?: number }
type Layout = 'modules' | 'single'
type Draft = { title: string; layout: Layout; minutes: number; m1: Block[]; m2: Block[] }
/** Which copy of a family the feed shows first. */
type ViewMode = 'smart' | 'orig' | 'both'
/** «Yangi» = hali hech qaysi mockda ishlatilmagan, «Ishlatilgan» = avval mockka olingan. */
type UsedMode = 'new' | 'used' | 'all'

const DRAFT_KEY = 'sat-mock-builder-draft'
const uid = () => Math.random().toString(36).slice(2, 10)
const plain = (s: string) => s.replace(/\$([^$]*)\$/g, '$1').replace(/\\[a-z]+/gi, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
const bestTwin = (twins: Twin[]) => twins.find((t) => t.keyChecked && !t.needsFigure) ?? twins.find((t) => !t.needsFigure) ?? null
const keyOf = (q: { type?: string; correct?: string; correctValue?: string }) =>
  (q.type === 'gridin' ? q.correctValue : q.correct) || null

function ago(iso?: string | null) {
  if (!iso) return ''
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000)
  if (d <= 0) return 'bugun'
  if (d === 1) return 'kecha'
  if (d < 30) return `${d} kun oldin`
  const m = Math.floor(d / 30)
  return m < 12 ? `${m} oy oldin` : `${Math.floor(m / 12)} yil oldin`
}

function loadDraft(): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
    if (d && Array.isArray(d.m1)) return d
  } catch {}
  return { title: '', layout: 'modules', minutes: 35, m1: [], m2: [] }
}

/* ------------------------------------------------------------------ panel */

/**
 * Admin «Mock tuzish»: «Xatolar bazasi» savollari — bot va saytdagi har bir xato javob, oilalarga yig‘ilgan —
 * uzluksiz skroll qilinadigan ikki ustunli lentada, PDF’dagidek to‘liq ko‘rinishda (matn, chizma, variantlar,
 * to‘g‘ri javob). Har savolni original yoki twin (sonlari o‘zgargan) holida bir bosishda mockka qo‘shasiz;
 * o‘ng tarafdagi panel — tuzilayotgan mock, DRAFT bo‘lib saqlanadi.
 */
export function MockBuilderPanel() {
  const [tab, setTab] = useState<'build' | 'twins'>('build')
  return (
    <div className="min-w-0">
      <div className="mbx-seg mb-4">
        {(
          [
            ['build', 'Konstruktor'],
            ['twins', 'Twinlar (egizak savollar)'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" data-on={tab === k ? '1' : '0'} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'build' ? <Builder /> : <TwinsManager />}
    </div>
  )
}

/* ------------------------------------------------------------------ builder */

function Builder() {
  const [draft, setDraft] = useState<Draft>({ title: '', layout: 'modules', minutes: 35, m1: [], m2: [] })
  const [ready, setReady] = useState(false)
  const [drawer, setDrawer] = useState(false)
  useEffect(() => {
    setDraft(loadDraft())
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {}
  }, [draft, ready])

  const placed = useMemo(() => {
    const m = new Map<string, { mod: 1 | 2; n: number }>()
    draft.m1.forEach((b, i) => m.set(b.family, { mod: 1, n: i + 1 }))
    draft.m2.forEach((b, i) => m.set(b.family, { mod: 2, n: i + 1 }))
    return m
  }, [draft])
  const total = draft.m1.length + draft.m2.length
  const single = draft.layout === 'single'

  const add = useCallback(
    (item: PoolItem, pick: 'orig' | string, to?: 1 | 2) => {
      setDraft((d) => {
        if ([...d.m1, ...d.m2].some((b) => b.family === item.family)) return d
        const block: Block = { uid: uid(), family: item.family, question: item.question, twins: item.twins, pick, misses: item.misses }
        const target = to ?? (d.layout === 'single' || d.m1.length < 22 || d.m1.length <= d.m2.length ? 1 : 2)
        return target === 1 ? { ...d, m1: [...d.m1, block] } : { ...d, m2: [...d.m2, block] }
      })
    },
    [],
  )
  const remove = useCallback((family: string) => {
    setDraft((d) => ({ ...d, m1: d.m1.filter((b) => b.family !== family), m2: d.m2.filter((b) => b.family !== family) }))
  }, [])
  /** Auto-pick: twin bo‘lsa twin, bo‘lmasa original. */
  const autoAdd = useCallback(
    (items: PoolItem[]) => {
      for (const it of items) {
        const t = bestTwin(it.twins)
        add(it, t ? (t.id as string) : 'orig')
      }
    },
    [add],
  )

  function move(from: { mod: 1 | 2; index: number }, to: { mod: 1 | 2; index: number }) {
    setDraft((d) => {
      const a = { 1: [...d.m1], 2: [...d.m2] } as Record<1 | 2, Block[]>
      const [b] = a[from.mod].splice(from.index, 1)
      if (!b) return d
      let idx = to.index
      if (from.mod === to.mod && from.index < idx) idx--
      a[to.mod].splice(Math.max(0, Math.min(idx, a[to.mod].length)), 0, b)
      return { ...d, m1: a[1], m2: a[2] }
    })
  }

  const panel = (floating: boolean) => (
    <MockPanel
      draft={draft}
      setDraft={setDraft}
      move={move}
      onAddDropped={(it, pick, mod, index) => {
        setDraft((d) => {
          if ([...d.m1, ...d.m2].some((b) => b.family === it.family)) return d
          const block: Block = { uid: uid(), family: it.family, question: it.question, twins: it.twins, pick, misses: it.misses }
          const list = [...(mod === 1 ? d.m1 : d.m2)]
          list.splice(Math.max(0, Math.min(index, list.length)), 0, block)
          return mod === 1 ? { ...d, m1: list } : { ...d, m2: list }
        })
      }}
      floating={floating}
      onClose={() => setDrawer(false)}
    />
  )

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,380px)] xl:items-start">
      <Feed placed={placed} onAdd={add} onRemove={remove} onAuto={autoAdd} single={single} />
      <div className="hidden xl:block">{panel(false)}</div>

      {/* Kichik ekranlarda — pastdagi "Mock" tugmasi va chiqib keladigan panel */}
      <button type="button" onClick={() => setDrawer(true)} className="mbx-fab xl:hidden">
        <ListChecks size={16} /> Mock
        <b className="tabular-nums">{total}</b>
      </button>
      {drawer && (
        <div className="fixed inset-0 z-[60] xl:hidden">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <div className="mbx-drawer">{panel(true)}</div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ feed */

function Feed({
  placed,
  onAdd,
  onRemove,
  onAuto,
  single,
}: {
  placed: Map<string, { mod: 1 | 2; n: number }>
  onAdd: (it: PoolItem, pick: 'orig' | string, to?: 1 | 2) => void
  onRemove: (family: string) => void
  onAuto: (items: PoolItem[]) => void
  single: boolean
}) {
  const [chat, setChat] = useState('')
  const [days, setDays] = useState('0')
  const [min, setMin] = useState(2)
  const [q, setQ] = useState('')
  const [domain, setDomain] = useState('')
  const [onlyTwins, setOnlyTwins] = useState(false)
  const [usedMode, setUsedMode] = useState<UsedMode>('new')
  const [view, setView] = useState<ViewMode>('smart')
  const [data, setData] = useState<{ items: PoolItem[]; groups: { chatId: number; title: string }[]; attempts: number; twinsMissing?: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoN, setAutoN] = useState(22)
  const [limit, setLimit] = useState(16)
  const bag = useBasket()

  function load(fresh = false) {
    setLoading(true)
    setErr(null)
    const sp = new URLSearchParams({ days, min: String(min) })
    if (chat) sp.set('chat', chat)
    if (fresh) sp.set('fresh', '1')
    fetch(`/api/admin/mistake-pool?${sp}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Xatolik')
        setData(d)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [chat, days, min]) // eslint-disable-line react-hooks/exhaustive-deps

  const base = useMemo(() => {
    const words = q.trim().toLowerCase()
    return (data?.items ?? []).filter(
      (it) =>
        (!domain || it.question.domain === domain) &&
        (!onlyTwins || it.twins.length > 0) &&
        (!words || plain(`${it.question.prompt} ${(it.question.equations ?? []).join(' ')} ${(it.labels ?? []).join(' ')}`).toLowerCase().includes(words)),
    )
  }, [data, q, domain, onlyTwins])

  const counts = useMemo(() => {
    let fresh = 0
    for (const it of base) if (!it.usedIn?.length) fresh++
    return { new: fresh, used: base.length - fresh, all: base.length }
  }, [base])

  const items = useMemo(
    () => base.filter((it) => (usedMode === 'all' ? true : usedMode === 'used' ? !!it.usedIn?.length : !it.usedIn?.length)),
    [base, usedMode],
  )

  const domains = useMemo(() => [...new Set((data?.items ?? []).map((it) => it.question.domain).filter(Boolean) as string[])].sort(), [data])

  // Filtr o‘zgarsa — lentani boshidan ko‘rsatamiz.
  useEffect(() => setLimit(16), [q, domain, onlyTwins, usedMode, chat, days, min])

  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && setLimit((n) => (n >= items.length ? n : n + 12)), { rootMargin: '900px' })
    io.observe(el)
    return () => io.disconnect()
  }, [items.length])

  async function fromBasket() {
    const ids = bag.filter((x) => x.qid).map((x) => x.qid as string)
    if (!ids.length) return
    const d = await fetch(`/api/admin/twins?questions=${ids.join(',')}`).then((r) => r.json()).catch(() => null)
    for (const it of (d?.items ?? []) as PoolItem[]) {
      const t = bestTwin(it.twins)
      onAdd(it, t ? (t.id as string) : 'orig')
    }
    basket.clear()
  }

  const patchTwin = (fam: string, t: Twin) =>
    setData((d) => (d ? { ...d, items: d.items.map((it) => (it.family === fam ? { ...it, twins: it.twins.map((x) => (x.id === t.id ? t : x)) } : it)) } : d))

  return (
    <section className="min-w-0">
      {/* ——— sticky filtrlar ——— */}
      <div className="mbx-bar">
        <div className="flex flex-wrap items-center gap-2">
          <Layers size={16} className="shrink-0 text-green-deep" />
          <h3 className="shrink-0 text-[14px] font-extrabold text-ink">Xatolar bazasi</h3>
          <span className="shrink-0 text-[11.5px] text-ink-faint">{data ? `${data.items.length} oila · ${data.attempts} urinish` : ''}</span>

          <div className="mbx-seg ml-auto">
            {(
              [
                ['new', 'Yangi', counts.new],
                ['used', 'Ishlatilgan', counts.used],
                ['all', 'Barchasi', counts.all],
              ] as const
            ).map(([k, l, n]) => (
              <button key={k} type="button" data-on={usedMode === k ? '1' : '0'} onClick={() => setUsedMode(k)} title={k === 'used' ? 'Avvalgi mocklarda ishlatilgan savollar' : undefined}>
                {k === 'used' && <History size={11} className="mr-1 inline align-[-1px]" />}
                {l} <span className="opacity-55 tabular-nums">{n}</span>
              </button>
            ))}
          </div>
          <button type="button" className="adm-btn !h-8 !px-2.5" onClick={() => load(true)} title="Yangilash" disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[180px] flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Savol matni yoki mock nomi" className="adm-input !h-8 w-full !pl-7 text-[12px]" />
          </label>
          <select value={chat} onChange={(e) => setChat(e.target.value)} className="adm-input !h-8 !w-auto text-[12px]">
            <option value="">Barcha guruhlar</option>
            {(data?.groups ?? []).map((g) => (
              <option key={g.chatId} value={g.chatId}>
                {g.title}
              </option>
            ))}
          </select>
          <select value={days} onChange={(e) => setDays(e.target.value)} className="adm-input !h-8 !w-auto text-[12px]">
            <option value="0">Butun vaqt</option>
            <option value="7">Oxirgi 7 kun</option>
            <option value="14">Oxirgi 14 kun</option>
            <option value="30">Oxirgi 30 kun</option>
            <option value="90">Oxirgi 90 kun</option>
          </select>
          <select value={min} onChange={(e) => setMin(Number(e.target.value))} className="adm-input !h-8 !w-auto text-[12px]">
            {[1, 2, 3, 5, 8, 10].map((n) => (
              <option key={n} value={n}>
                Kamida {n} xato
              </option>
            ))}
          </select>
          <select value={domain} onChange={(e) => setDomain(e.target.value)} className="adm-input !h-8 !w-auto max-w-[190px] text-[12px]">
            <option value="">Barcha mavzular</option>
            {domains.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <label className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-bold text-ink-soft">
            <input type="checkbox" checked={onlyTwins} onChange={(e) => setOnlyTwins(e.target.checked)} /> Twini borlar
          </label>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-faint">
            <Eye size={12} /> Ko‘rinish
          </span>
          <div className="mbx-seg">
            {(
              [
                ['smart', 'Twin bo‘lsa — twin'],
                ['orig', 'Original'],
                ['both', 'Ikkalasi ham'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" data-on={view === k ? '1' : '0'} onClick={() => setView(k)}>
                {l}
              </button>
            ))}
          </div>
          <span className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:block" />
          <button type="button" className="adm-btn !h-8 text-[11.5px]" onClick={() => onAuto(items.filter((it) => !placed.has(it.family)).slice(0, autoN))}>
            <Wand2 size={13} /> Eng ko‘p xatodan
          </button>
          <select value={autoN} onChange={(e) => setAutoN(Number(e.target.value))} className="adm-input !h-8 !w-auto text-[11.5px]">
            {[10, 22, 44].map((n) => (
              <option key={n} value={n}>
                {n} ta
              </option>
            ))}
          </select>
          {bag.some((x) => x.qid) && (
            <button type="button" className="adm-btn !h-8 text-[11.5px]" onClick={fromBasket}>
              <ShoppingBasket size={13} /> To‘plamdan ({bag.filter((x) => x.qid).length})
            </button>
          )}
          <span className="ml-auto text-[11.5px] font-semibold tabular-nums text-ink-faint">{items.length} ta savol</span>
        </div>
      </div>

      {/* ——— xabarlar ——— */}
      {err && <p className="mt-3 text-[12.5px] font-semibold text-red-600">{err}</p>}
      {data?.twinsMissing && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] font-semibold text-amber-800">
          Twin jadvali hali yo‘q — supabase/v112_twins.sql ni ishga tushiring. Hozircha faqat original savollar bilan ishlaydi.
        </p>
      )}
      {!data && !err && (
        <div className="flex items-center gap-2 py-10 text-[12.5px] text-ink-faint">
          <Loader2 size={14} className="animate-spin" /> Bot va sayt xatolari yig‘ilmoqda...
        </div>
      )}
      {data && items.length === 0 && (
        <p className="py-14 text-center text-[12.5px] text-ink-faint">
          {usedMode === 'new' ? 'Bu filtr bo‘yicha yangi savol yo‘q — «Ishlatilgan» yoki «Barchasi» ga o‘ting.' : 'Bu filtr bo‘yicha savol yo‘q.'}
        </p>
      )}

      {/* ——— ikki ustunli lenta ——— */}
      <div className="mt-3 grid gap-3.5 lg:grid-cols-2 lg:gap-4">
        {items.slice(0, limit).map((it) => (
          <QuestionTile
            key={it.family}
            item={it}
            view={view}
            single={single}
            at={placed.get(it.family)}
            onAdd={onAdd}
            onRemove={onRemove}
            onTwinPatched={(t) => patchTwin(it.family, t)}
          />
        ))}
      </div>
      <div ref={sentinel} className="h-10" />
      {limit < items.length && (
        <div className="flex justify-center pb-4">
          <button type="button" className="adm-btn" onClick={() => setLimit((n) => n + 20)}>
            Yana {Math.min(20, items.length - limit)} ta
          </button>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ one question */

/** Lenta silliq qolishi uchun: karta ekranga yaqinlashgandagina chizamiz (KaTeX og‘ir). */
function Lazy({ minHeight, children }: { minHeight: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || on) return
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && setOn(true), { rootMargin: '700px' })
    io.observe(el)
    return () => io.disconnect()
  }, [on])
  return (
    <div ref={ref} style={on ? undefined : { minHeight }}>
      {on ? children : <div className="mbx-skeleton" style={{ height: minHeight - 12 }} />}
    </div>
  )
}

function QuestionTile({
  item,
  view,
  single,
  at,
  onAdd,
  onRemove,
  onTwinPatched,
}: {
  item: PoolItem
  view: ViewMode
  single: boolean
  at?: { mod: 1 | 2; n: number }
  onAdd: (it: PoolItem, pick: 'orig' | string, to?: 1 | 2) => void
  onRemove: (family: string) => void
  onTwinPatched: (t: Twin) => void
}) {
  const auto = bestTwin(item.twins)
  const [pick, setPick] = useState<'orig' | string>(() => (view === 'orig' || !auto ? 'orig' : (auto.id as string)))
  useEffect(() => setPick(view === 'orig' || !auto ? 'orig' : (auto.id as string)), [view, auto?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const twin = pick === 'orig' ? null : item.twins.find((t) => t.id === pick) ?? null
  const shown = (twin ?? item.question) as PoolQ
  const stacked = view === 'both' && item.twins.length > 0
  const used = item.usedIn ?? []
  const picked = !!at

  const addBtns = (p: 'orig' | string) =>
    picked ? (
      <button type="button" onClick={() => onRemove(item.family)} className="mbx-add is-off">
        <X size={14} /> Mockdan olib tashlash
      </button>
    ) : single ? (
      <button type="button" onClick={() => onAdd(item, p, 1)} className="mbx-add">
        <Plus size={14} /> Mockka qo‘shish
      </button>
    ) : (
      <>
        <button type="button" onClick={() => onAdd(item, p, 1)} className="mbx-add">
          <Plus size={14} /> 1-modul
        </button>
        <button type="button" onClick={() => onAdd(item, p, 2)} className="mbx-add is-ghost">
          <Plus size={14} /> 2-modul
        </button>
      </>
    )

  return (
    <article
      draggable={!picked}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-pool', JSON.stringify({ item, pick }))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      className={`mbx-card flex min-w-0 flex-col ${picked ? 'is-picked' : ''}`}
    >
      {/* ——— sarlavha ——— */}
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-3.5 py-2.5">
        <span className="mbx-miss">
          <b>{item.misses ?? 0}</b> xato
          <i>{Math.round((item.rate ?? 0) * 100)}%</i>
        </span>
        {item.question.domain && <span className="text-[11.5px] font-bold text-ink">{item.question.domain}</span>}
        {item.question.difficulty && <span className="mbx-chip">{item.question.difficulty}</span>}
        {item.question.type === 'gridin' && <span className="mbx-chip">Grid-in</span>}
        {keyOf(shown) && <span className="mbx-key">Javob: {keyOf(shown)}</span>}
        {picked && (
          <span className="mbx-in">
            <Check size={11} /> {single ? 'Mockda' : `${at!.mod}-modul`} · {at!.n}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1" title={`${item.twins.length} ta twin`}>
          {item.twins.map((t) => (
            <span key={t.id} className={`size-2 rounded-full ${t.needsFigure ? 'bg-slate-300' : t.keyChecked ? 'bg-[#16a34a]' : 'bg-amber-400'}`} />
          ))}
        </span>
      </header>

      {/* ——— manba / tarix ——— */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3.5 pt-2 text-[10.5px] text-ink-faint">
        {item.labels?.[0] && (
          <span className="truncate">
            {item.labels[0]}
            {(item.labels.length ?? 0) > 1 ? ` +${item.labels.length - 1}` : ''}
          </span>
        )}
        {item.students ? <span>· {item.students} o‘quvchi</span> : null}
        {item.lastAt && <span>· {ago(item.lastAt)}</span>}
        {used.length > 0 && (
          <span className="mbx-used" title={used.map((u) => u.label).join('\n')}>
            <History size={10} /> Ishlatilgan: {used[0].label}
            {used.length > 1 ? ` +${used.length - 1}` : ''} · {ago(used[0].at)}
          </span>
        )}
      </div>

      {/* ——— original / twin ——— */}
      {item.twins.length > 0 && !stacked && (
        <div className="px-3.5 pt-2.5">
          <div className="mbx-seg !w-full">
            <button type="button" data-on={pick === 'orig' ? '1' : '0'} onClick={() => setPick('orig')} className="flex-1">
              Original
            </button>
            {item.twins.map((t) => (
              <button key={t.id} type="button" data-on={pick === t.id ? '1' : '0'} onClick={() => setPick(t.id as string)} className="flex-1" title={t.keyChecked ? 'Kaliti tasdiqlangan' : 'Kaliti tekshirilmagan'}>
                <Sparkles size={11} className="mr-1 inline align-[-1px]" />
                Twin {t.variant}
                {t.needsFigure ? ' ✎' : t.keyChecked ? ' ✓' : ' ?'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ——— savolning o‘zi (PDF ko‘rinishi) ——— */}
      <div className="min-w-0 flex-1 px-3.5 py-3">
        <Lazy minHeight={240}>
          {stacked ? (
            <div className="space-y-3">
              <div>
                <p className="mbx-label">Original</p>
                <QuestionCard q={item.question} />
                {!picked && <div className="mt-2 flex flex-wrap gap-1.5">{addBtns('orig')}</div>}
              </div>
              {item.twins.map((t) => (
                <div key={t.id} className="rounded-2xl border border-line p-2.5">
                  <TwinReview twin={t} onChange={onTwinPatched} />
                  {!picked && <div className="mt-2 flex flex-wrap gap-1.5">{addBtns(t.id as string)}</div>}
                </div>
              ))}
            </div>
          ) : twin ? (
            <TwinReview twin={twin} onChange={onTwinPatched} />
          ) : (
            <QuestionCard q={item.question} />
          )}
        </Lazy>
      </div>

      {/* ——— qo‘shish ——— */}
      {!stacked && (
        <footer className="flex flex-wrap items-center gap-1.5 border-t border-line px-3.5 py-2.5">
          {addBtns(pick)}
          {!picked && twin && !twin.keyChecked && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700">
              <AlertTriangle size={11} /> twin kaliti tasdiqlanmagan
            </span>
          )}
        </footer>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ mock panel */

function MockPanel({
  draft,
  setDraft,
  move,
  onAddDropped,
  floating,
  onClose,
}: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  move: (from: { mod: 1 | 2; index: number }, to: { mod: 1 | 2; index: number }) => void
  onAddDropped: (it: PoolItem, pick: 'orig' | string, mod: 1 | 2, index: number) => void
  floating: boolean
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const drag = useRef<{ mod: 1 | 2; index: number } | null>(null)
  const [over, setOver] = useState<{ mod: 1 | 2; index: number } | null>(null)
  const single = draft.layout === 'single'

  const list = (m: 1 | 2) => (m === 1 ? draft.m1 : draft.m2)
  const setList = (m: 1 | 2, next: Block[]) => setDraft((d) => (m === 1 ? { ...d, m1: next } : { ...d, m2: next }))

  function onDrop(e: React.DragEvent, mod: 1 | 2, index: number) {
    e.preventDefault()
    setOver(null)
    const pool = e.dataTransfer.getData('application/x-pool')
    if (pool) {
      try {
        const { item, pick } = JSON.parse(pool) as { item: PoolItem; pick: 'orig' | string }
        onAddDropped(item, pick, mod, index)
      } catch {}
      return
    }
    if (drag.current) move(drag.current, { mod, index })
    drag.current = null
  }

  const all = [...draft.m1, ...draft.m2]
  const total = all.length
  const unchecked = all.filter((b) => b.pick !== 'orig' && !b.twins.find((t) => t.id === b.pick)?.keyChecked).length
  const noKey = all.filter((b) => {
    const v = b.pick === 'orig' ? b.question : b.twins.find((t) => t.id === b.pick)
    return v && !keyOf(v)
  }).length
  const twinsUsed = all.filter((b) => b.pick !== 'orig').length
  const over22 = !single && (draft.m1.length > 22 || draft.m2.length > 22)
  const over44 = single && all.length > 44

  async function create() {
    if (!draft.title.trim() || busy) return
    setBusy(true)
    setMsg(null)
    const toItem = (b: Block, module: 1 | 2) => (b.pick === 'orig' ? { questionId: b.question.id, module } : { twinId: b.pick, module })
    const items = single ? all.map((b) => toItem(b, 1)) : [...draft.m1.map((b) => toItem(b, 1)), ...draft.m2.map((b) => toItem(b, 2))]
    const res = await fetch('/api/admin/review-mock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: draft.title.trim(), layout: draft.layout, minutes: draft.minutes, items }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (!res?.ok) return setMsg({ ok: false, text: d?.error ?? 'Yaratib bo‘lmadi.' })
    setMsg({ ok: true, text: `"${d.testLabel}" yaratildi — ${d.count} ta savol, DRAFT. «Mocklar» bo‘limida tekshirib nashr qiling.` })
    setDraft({ title: '', layout: draft.layout, minutes: draft.minutes, m1: [], m2: [] })
  }

  const column = (mod: 1 | 2, title: string) => {
    const blocks = list(mod)
    const cap = single ? 44 : 22
    return (
      <div
        className={`mbx-drop ${over?.mod === mod ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (over?.mod !== mod || over.index !== blocks.length) setOver({ mod, index: blocks.length })
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null)
        }}
        onDrop={(e) => onDrop(e, mod, over?.mod === mod ? over.index : blocks.length)}
      >
        <div className="mb-1.5 flex items-center gap-2 px-0.5">
          <b className="text-[12px] text-ink">{title}</b>
          <span className={`text-[11px] font-bold tabular-nums ${blocks.length > cap ? 'text-red-600' : 'text-ink-faint'}`}>
            {blocks.length}/{cap}
          </span>
          {blocks.length > 0 && (
            <button type="button" className="ml-auto text-[10.5px] font-bold text-ink-faint hover:text-red-600" onClick={() => setList(mod, [])}>
              Tozalash
            </button>
          )}
        </div>
        {blocks.length === 0 && <p className="px-3 py-6 text-center text-[11.5px] leading-relaxed text-ink-faint">Savollarni shu yerga sudrang yoki kartadagi «+» ni bosing</p>}
        <ol className="space-y-1">
          {blocks.map((b, i) => (
            <li key={b.uid}>
              {over?.mod === mod && over.index === i && <div className="mb-1 h-[3px] rounded-full bg-green" />}
              <MiniBlock
                n={i + 1}
                block={b}
                onDragStart={() => (drag.current = { mod, index: i })}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const r = e.currentTarget.getBoundingClientRect()
                  const idx = e.clientY < r.top + r.height / 2 ? i : i + 1
                  if (over?.mod !== mod || over.index !== idx) setOver({ mod, index: idx })
                }}
                onDrop={(e) => {
                  e.stopPropagation()
                  onDrop(e, mod, over?.mod === mod ? over.index : i)
                }}
                onPick={(pick) => {
                  const arr = [...list(mod)]
                  arr[i] = { ...b, pick }
                  setList(mod, arr)
                }}
                onRemove={() => setList(mod, list(mod).filter((x) => x.uid !== b.uid))}
                onUp={i > 0 ? () => move({ mod, index: i }, { mod, index: i - 1 }) : undefined}
                onDown={i < blocks.length - 1 ? () => move({ mod, index: i }, { mod, index: i + 2 }) : undefined}
                onOther={single ? undefined : () => move({ mod, index: i }, { mod: mod === 1 ? 2 : 1, index: list(mod === 1 ? 2 : 1).length })}
                otherLabel={mod === 1 ? '→2' : '→1'}
              />
            </li>
          ))}
          {over?.mod === mod && over.index === blocks.length && blocks.length > 0 && <div className="h-[3px] rounded-full bg-green" />}
        </ol>
      </div>
    )
  }

  return (
    <section className={floating ? 'mbx-panel is-floating' : 'mbx-panel'}>
      <header className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <ListChecks size={15} className="text-green-deep" />
        <h3 className="text-[13.5px] font-extrabold text-ink">Tuzilayotgan mock</h3>
        <span className="rounded-full bg-green-mist px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-green-deep">{total}</span>
        {floating && (
          <button type="button" onClick={onClose} className="ml-auto p-1 text-ink-faint hover:text-ink">
            <X size={16} />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Mock nomi — masalan: Takrorlash Mock 3"
          className="adm-input w-full text-[13px]"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="mbx-seg">
            {(
              [
                ['modules', 'Ikki modul'],
                ['single', 'Bir modul'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                data-on={draft.layout === k ? '1' : '0'}
                onClick={() =>
                  setDraft((d) => {
                    if (d.layout === k) return d
                    const flat = [...d.m1, ...d.m2]
                    const half = Math.ceil(flat.length / 2)
                    return k === 'single'
                      ? { ...d, layout: k, m1: flat, m2: [], minutes: Math.max(d.minutes, 70) }
                      : { ...d, layout: k, m1: flat.slice(0, half), m2: flat.slice(half), minutes: Math.min(d.minutes, 35) }
                  })
                }
              >
                {l}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-ink-soft">
            {single ? 'Jami daq.' : 'Modulga daq.'}
            <input
              type="number"
              min={1}
              max={300}
              value={draft.minutes}
              onChange={(e) => setDraft((d) => ({ ...d, minutes: Number(e.target.value) || 1 }))}
              className="adm-input !h-8 !w-16 text-[12px]"
            />
          </label>
        </div>

        <div className="mt-3 space-y-3">{single ? column(1, 'Savollar') : (<>{column(1, 'Module 1')}{column(2, 'Module 2')}</>)}</div>
      </div>

      <footer className="border-t border-line p-3">
        <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold text-ink-soft">
          <span>Twin: <b className="text-ink tabular-nums">{twinsUsed}</b></span>
          {unchecked > 0 && <span className="text-amber-700">⚠ {unchecked} twin kaliti tasdiqlanmagan</span>}
          {noKey > 0 && <span className="text-red-600">⚠ {noKey} savolda kalit yo‘q</span>}
          {over22 && <span className="text-red-600">Har modulda ko‘pi bilan 22 ta</span>}
          {over44 && <span className="text-red-600">Ko‘pi bilan 44 ta</span>}
        </div>
        <button type="button" onClick={create} disabled={busy || !draft.title.trim() || total === 0 || over22 || over44} className="mbx-create">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Mockni yaratish (DRAFT)
        </button>
        {msg && <p className={`mt-2 text-[12px] font-semibold ${msg.ok ? 'text-green-deep' : 'text-red-600'}`}>{msg.text}</p>}
        {!msg && <p className="mt-1.5 text-[10.5px] text-ink-faint">Qoralama shu brauzerda avtomatik saqlanadi.</p>}
      </footer>
    </section>
  )
}

function MiniBlock({
  n,
  block,
  onDragStart,
  onDragOver,
  onDrop,
  onPick,
  onRemove,
  onUp,
  onDown,
  onOther,
  otherLabel,
}: {
  n: number
  block: Block
  onDragStart: () => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  onPick: (pick: 'orig' | string) => void
  onRemove: () => void
  onUp?: () => void
  onDown?: () => void
  onOther?: () => void
  otherLabel: string
}) {
  const twin = block.pick === 'orig' ? null : block.twins.find((t) => t.id === block.pick) ?? null
  const shown = twin ?? block.question
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', block.uid)
        onDragStart()
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="mbx-mini group"
    >
      <GripVertical size={13} className="shrink-0 cursor-grab text-ink-faint" />
      <span className="w-5 shrink-0 text-center text-[11.5px] font-extrabold tabular-nums text-ink">{n}</span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">{plain(shown.prompt) || '(rasmli savol)'}</span>
      <select
        value={block.pick}
        onChange={(e) => onPick(e.target.value)}
        className={`h-6 shrink-0 rounded-md border px-1 text-[10px] font-bold ${twin ? (twin.keyChecked ? 'border-green bg-green-mist text-green-deep' : 'border-amber-400 bg-amber-50 text-amber-800') : 'border-line text-ink-soft'}`}
        title="Original yoki twin"
      >
        <option value="orig">Orig</option>
        {block.twins.map((t) => (
          <option key={t.id} value={t.id}>
            Twin {t.variant}
            {t.keyChecked ? ' ✓' : ' ?'}
          </option>
        ))}
      </select>
      <span className="hidden shrink-0 items-center group-hover:flex">
        {onUp && (
          <button type="button" onClick={onUp} className="p-0.5 text-ink-faint hover:text-ink" title="Yuqoriga">
            <ArrowUp size={12} />
          </button>
        )}
        {onDown && (
          <button type="button" onClick={onDown} className="p-0.5 text-ink-faint hover:text-ink" title="Pastga">
            <ArrowDown size={12} />
          </button>
        )}
        {onOther && (
          <button type="button" onClick={onOther} className="px-0.5 text-[10px] font-bold text-ink-faint hover:text-ink" title="Boshqa modulga">
            {otherLabel}
          </button>
        )}
      </span>
      <button type="button" onClick={onRemove} className="shrink-0 p-0.5 text-ink-faint hover:text-red-600" title="Olib tashlash">
        <X size={13} />
      </button>
    </div>
  )
}

export function TwinReview({ twin, onChange }: { twin: Twin; onChange: (t: Twin) => void }) {
  const [busy, setBusy] = useState(false)
  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    const d = await fetch('/api/admin/twins', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: twin.id, ...body }) })
      .then((r) => r.json())
      .catch(() => null)
    setBusy(false)
    if (d?.twin) onChange(d.twin)
  }
  const setKey = (k: string) => {
    const { id: _i, familyId: _f, sourceId: _s, variant: _v, keyChecked: _k, needsFigure: _n, kind: _kind, ...q } = twin
    void _i
    void _f
    void _s
    void _v
    void _k
    void _n
    void _kind
    patch({ question: twin.type === 'gridin' ? { ...q, correctValue: k } : { ...q, correct: k }, keyChecked: true })
  }
  return (
    <div className={`rounded-xl border p-2.5 ${twin.keyChecked ? 'border-green/60' : 'border-amber-300 bg-amber-50/40'}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-ink-faint">Twin {twin.variant}</span>
        {twin.keyChecked ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-deep">
            <Check size={12} /> kalit tasdiqlangan
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
            <AlertTriangle size={12} /> kalit tekshirilmagan
          </span>
        )}
        {twin.needsFigure && <span className="text-[11px] font-bold text-slate-500">· yangi chizma kerak</span>}
        <span className="ml-auto flex items-center gap-1">
          {busy && <Loader2 size={13} className="animate-spin text-ink-faint" />}
          {twin.type === 'gridin' ? (
            <GridKey value={twin.correctValue ?? ''} onSave={setKey} />
          ) : (
            (twin.choices ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setKey(c.id)}
                title="Shu javobni to‘g‘ri deb belgilash"
                className={`size-6 rounded-full border text-[11px] font-extrabold ${twin.correct === c.id ? 'border-[#16a34a] bg-[#16a34a] text-white' : 'border-ink-faint bg-white text-ink hover:border-[#16a34a]'}`}
              >
                {c.id}
              </button>
            ))
          )}
          {!twin.keyChecked && (
            <button type="button" className="adm-btn !h-6 !px-2 text-[10.5px]" onClick={() => patch({ keyChecked: true })}>
              <Check size={11} /> To‘g‘ri
            </button>
          )}
        </span>
      </div>
      <QuestionCard q={twin} compact />
    </div>
  )
}

function GridKey({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (v.trim()) onSave(v.trim())
      }}
    >
      <input value={v} onChange={(e) => setV(e.target.value)} className="adm-input !h-6 !w-20 text-[11.5px]" />
      <button type="submit" className="adm-btn !h-6 !px-2 text-[10.5px]">
        Saqlash
      </button>
    </form>
  )
}

/* ------------------------------------------------------------------ twins manager */

type Coverage = { label: string; placement: string; total: number; withTwin: number; checked: number; withImage: number }

/** Coverage per mock + export (for GPT / Claude) + import of the generated twins. */
function TwinsManager() {
  const [cov, setCov] = useState<{ mocks: Coverage[]; twins: number; families: number; missing?: boolean; error?: string } | null>(null)
  const [json, setJson] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; details?: string[] } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const load = () =>
    fetch('/api/admin/twins?coverage=1')
      .then((r) => r.json())
      .then(setCov)
      .catch(() => setCov({ mocks: [], twins: 0, families: 0, error: 'Yuklab bo‘lmadi' }))
  useEffect(() => {
    load()
  }, [])

  async function exportMock(label: string, mode: 'copy' | 'file') {
    const d = await fetch(`/api/admin/twins/export?label=${encodeURIComponent(label)}&missing=1`).then((r) => r.json())
    const text = JSON.stringify(d, null, 1)
    if (mode === 'copy') {
      await navigator.clipboard?.writeText(text).catch(() => {})
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      a.download = `${label.replace(/[^\w\- ]+/g, '').trim() || 'mock'} — twin uchun.json`
      a.click()
    }
  }

  async function importTwins(text: string) {
    setBusy(true)
    setMsg(null)
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      setBusy(false)
      return setMsg({ ok: false, text: 'JSON noto‘g‘ri — oxirgi qavslarni tekshiring.' })
    }
    const res = await fetch('/api/admin/twins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ twins: body }) }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (!res?.ok) return setMsg({ ok: false, text: d?.error ?? 'Import bo‘lmadi', details: d?.details })
    setMsg({ ok: true, text: `${d.imported} ta twin qo‘shildi. Kalitlarni «Konstruktor»da ko‘rib, bir bosishda tasdiqlang.` })
    setJson('')
    load()
  }

  const mocks = (cov?.mocks ?? []).filter((m) => !filter || m.label.toLowerCase().includes(filter.toLowerCase()))
  const sum = (cov?.mocks ?? []).reduce((a, m) => ({ total: a.total + m.total, tw: a.tw + m.withTwin, ch: a.ch + m.checked }), { total: 0, tw: 0, ch: 0 })

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <section className="min-w-0 rounded-2xl border border-line bg-white p-3.5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-[14px] font-extrabold text-ink">Mocklar bo‘yicha twin qamrovi</h3>
          {cov && !cov.missing && (
            <span className="text-[12px] font-semibold text-ink-soft">
              {sum.tw}/{sum.total} savolda twin bor · {sum.ch} tasining kaliti tasdiqlangan
            </span>
          )}
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Mock qidirish" className="adm-input !ml-auto !h-8 !w-48 text-[12px]" />
        </div>
        {cov?.missing && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">{cov.error}</p>}
        {!cov && (
          <div className="flex items-center gap-2 text-[12.5px] text-ink-faint">
            <Loader2 size={14} className="animate-spin" /> Yuklanmoqda...
          </div>
        )}
        <div className="divide-y divide-line">
          {mocks.map((m) => {
            const pct = m.total ? m.withTwin / m.total : 0
            return (
              <div key={m.label} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-ink">
                    {m.label}
                    {m.placement === 'course_task' && <span className="ml-1.5 rounded bg-bg-deep px-1.5 py-px text-[9.5px] font-extrabold text-ink-faint">VAZIFA</span>}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-bg-deep">
                      <div className="h-full rounded-full bg-green" style={{ width: `${pct * 100}%` }} />
                    </div>
                    <span className="text-[11px] tabular-nums text-ink-faint">
                      {m.withTwin}/{m.total} · {m.checked} ✓{m.withImage ? ` · ${m.withImage} rasmli` : ''}
                    </span>
                  </div>
                </div>
                {m.withTwin < m.total && (
                  <>
                    <button type="button" className="adm-btn !h-8 text-[11.5px]" onClick={() => exportMock(m.label, 'copy')} title="Twini yo‘q savollarni JSON qilib nusxalash">
                      {copied === m.label ? <Check size={13} /> : <Copy size={13} />} Nusxa
                    </button>
                    <button type="button" className="adm-btn !h-8 text-[11.5px]" onClick={() => exportMock(m.label, 'file')}>
                      .json
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="min-w-0 space-y-3">
        <div className="rounded-2xl border border-line bg-white p-3.5">
          <h3 className="mb-1 text-[14px] font-extrabold text-ink">Twinlarni import qilish</h3>
          <p className="mb-2 text-[11.5px] leading-relaxed text-ink-soft">
            1) Chapdan mockni «Nusxa» qiling. 2) GPT/Claude chatiga pastdagi promptni, keyin JSON’ni tashlang. 3) Javobni shu yerga qo‘ying. Har bir twin
            o‘z <code>sourceId</code> savoliga bog‘lanadi; kalitlar «tekshirilmagan» bo‘lib kiradi.
          </p>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={9}
            placeholder='[{ "sourceId": "…", "type": "mcq", "prompt": "…", "choices": [...], "correct": "B" }]'
            className="adm-input w-full !h-auto py-2 font-mono text-[11.5px]"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !json.trim()}
              onClick={() => importTwins(json)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green px-3.5 py-2 text-[12.5px] font-extrabold text-white disabled:opacity-40"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Import
            </button>
            <label className="adm-btn !h-9 cursor-pointer text-[12px]">
              .json fayl
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) importTwins(await f.text())
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {msg && (
            <div className={`mt-2 text-[12px] font-semibold ${msg.ok ? 'text-green-deep' : 'text-red-600'}`}>
              {msg.text}
              {msg.details && (
                <ul className="mt-1 list-disc pl-5 font-normal">
                  {msg.details.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-white p-3.5">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-[14px] font-extrabold text-ink">Twin prompti</h3>
            <button
              type="button"
              className="adm-btn !ml-auto !h-8 text-[11.5px]"
              onClick={() => {
                navigator.clipboard?.writeText(TWIN_PROMPT).catch(() => {})
                setCopied('prompt')
                setTimeout(() => setCopied(null), 1500)
              }}
            >
              {copied === 'prompt' ? <Check size={13} /> : <Copy size={13} />} Nusxalash
            </button>
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-deep p-2.5 font-mono text-[10.5px] leading-relaxed text-ink-soft">{TWIN_PROMPT}</pre>
        </div>
        <TwinsLegend />
      </section>
    </div>
  )
}

function TwinsLegend() {
  return (
    <div className="rounded-2xl border border-line bg-white p-3.5 text-[11.5px] leading-relaxed text-ink-soft">
      <p className="mb-1 font-extrabold text-ink">Belgilar</p>
      <p>
        <span className="mr-1 inline-block size-2.5 rounded-full bg-[#16a34a] align-middle" /> kalit tasdiqlangan ·{' '}
        <span className="mx-1 inline-block size-2.5 rounded-full bg-amber-400 align-middle" /> tekshirilmagan ·{' '}
        <span className="mx-1 inline-block size-2.5 rounded-full bg-slate-300 align-middle" /> yangi chizma kerak
      </p>
      <p className="mt-1.5">
        Takrorlash mockidagi savol o‘z oilasini eslab qoladi: uni yana xato qilishsa, xato <b>o‘sha oilaga</b> qo‘shiladi — baza yangi «bir xil» savollar bilan
        to‘lmaydi, twinlar qayta-qayta ishlatiladi.
      </p>
    </div>
  )
}

export const TWIN_PROMPT = `SEN — Digital SAT Math savollari uchun "egizak" (twin) yasovchisan. Senga JSON array beriladi: har bir element bitta savol, "sourceId" bilan.

VAZIFA: har bir savol uchun bitta twin yoz — xuddi shu savol, faqat SONLARI boshqa.
1. Tuzilma, mavzu (domain), qiyinlik (difficulty), savol turi (mcq/gridin), so'zlar va kontekst bir xil qoladi. Faqat sonlar (koeffitsientlar, qiymatlar, o'lchamlar, foizlar) o'zgaradi.
2. Yangi sonlar "chiroyli" chiqsin: javob butun son yoki oddiy kasr bo'lsin, ildiz/diskriminant mos kelsin, real SAT darajasida.
3. Savolni o'zing to'liq yech va yangi to'g'ri javobni yoz: mcq → "correct": "A".."D"; gridin → "correctValue": "...". Variantlarni yangi sonlarga moslab qayta tuz (to'g'ri javob har doim bitta; chalg'ituvchilar tipik xatolardan chiqsin). To'g'ri javob harfini tasodifiy joylashtir.
4. "explanation" — yangi sonlar bilan qisqa yechim ($...$ ichida formulalar).
5. Agar savolda rasm/grafik bor va SONLAR RASMDA bo'lsa (rasmni ko'rmasang ham matndan sezsang): matndagi sonlarni o'zgartirma, "needsFigure": true qo'y va baribir twin yoz (matn rasm bilan mos qolsin). Agar sonlar faqat matnda bo'lsa — "image" maydonini YOZMA (asl rasm ishlatiladi).
6. FORMAT — kirishdagi bilan bir xil admin JSON: "sourceId" (o'zgartirmasdan ko'chir), "type", "difficulty", "domain", "prompt", "equations" (bo'lsa), "choices" (mcq), "correct"/"correctValue", "explanation", kerak bo'lsa "needsFigure". "no" va "id" yozma.
7. Gap ichidagi formula $...$ ichida; JSON ichida har bir backslash ikkita (\\\\dfrac). Variant faqat formula bo'lsa "tex", aks holda "text".
8. Javobing FAQAT toza JSON array — izohsiz, \`\`\` belgilarisiz. Savollar soni = kirishdagi savollar soni, tartib saqlanadi.`
