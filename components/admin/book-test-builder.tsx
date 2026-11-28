'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, BookOpen, Copy, Loader2, Shuffle, SortAsc, Trash2, X } from 'lucide-react'
import { RichText } from '@/components/rich-text'
import { bookBasket, useBookBasket, type BookPick } from '@/components/admin/book-basket'
import type { Twin } from '@/lib/twins'

type Layout = 'modules' | 'single'
const DIFF_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }

/** Tanlangan savol qaysi modulga tushadi: 1 yoki 2 (bir modulli testda hammasi 1-da). */
type Slot = { pick: BookPick; module: 1 | 2; use: 'orig' | string }

const inp = 'rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-green'

/**
 * «Kitobdan test tuzish»: SQB kitob bankida varaqlab tick qo'yilgan savollardan tayyor mock yasaydi.
 * Savollar mockka nusxalanadi, lekin har biri o'z kitob savolini «oila boshi» sifatida eslab qoladi —
 * shuning uchun xatolar o'sha oilaga yig'iladi va oilaning twini (sonlari o'zgargan nusxasi) qayta ishlatiladi.
 */
export function BookTestBuilder({ onBrowse }: { onBrowse?: () => void } = {}) {
  const picked = useBookBasket()
  const [slots, setSlots] = useState<Slot[]>([])
  const [twins, setTwins] = useState<Record<string, Twin[]>>({})
  const [title, setTitle] = useState('')
  const [layout, setLayout] = useState<Layout>('modules')
  const [minutes, setMinutes] = useState(35)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Tanlov o'zgarsa — yangi savollar oxiriga qo'shiladi, olib tashlanganlari chiqib ketadi.
  useEffect(() => {
    setSlots((cur) => {
      const have = new Map(cur.map((s) => [s.pick.id, s]))
      const ids = new Set(picked.map((p) => p.id))
      const kept = cur.filter((s) => ids.has(s.pick.id))
      const added = picked.filter((p) => !have.has(p.id)).map<Slot>((p) => ({ pick: p, module: 1, use: 'orig' }))
      const next = [...kept, ...added]
      // Modullarni avtomatik yarmidan bo'lish (admin keyin qo'lda ko'chirishi mumkin).
      if (added.length) {
        const half = Math.ceil(next.length / 2)
        return next.map((s, i) => ({ ...s, module: i < half ? 1 : 2 }))
      }
      return next
    })
  }, [picked])

  // Qaysi savolning twini bor — «Twin» tanlovini ko'rsatish uchun.
  const ids = useMemo(() => picked.map((p) => p.id), [picked])
  useEffect(() => {
    if (!ids.length) return setTwins({})
    let alive = true
    ;(async () => {
      const out: Record<string, Twin[]> = {}
      for (let i = 0; i < ids.length; i += 150) {
        const chunk = ids.slice(i, i + 150)
        const r = await fetch(`/api/admin/twins?bank=${chunk.join(',')}`).catch(() => null)
        const d = r && r.ok ? await r.json().catch(() => null) : null
        for (const it of (d?.items ?? []) as { family: string; twins: Twin[] }[]) if (it.twins?.length) out[it.family] = it.twins
      }
      if (alive) setTwins(out)
    })()
    return () => {
      alive = false
    }
  }, [ids])

  const single = layout === 'single'
  const m1 = slots.filter((s) => s.module !== 2)
  const m2 = slots.filter((s) => s.module === 2)
  const cap = single ? 44 : 22
  const over = single ? slots.length > 44 : m1.length > 22 || m2.length > 22

  const patch = (id: string, p: Partial<Slot>) => setSlots((l) => l.map((s) => (s.pick.id === id ? { ...s, ...p } : s)))
  const move = (id: string, dir: -1 | 1) =>
    setSlots((l) => {
      const i = l.findIndex((s) => s.pick.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= l.length) return l
      const next = [...l]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const sortBy = (how: 'topic' | 'difficulty' | 'shuffle') =>
    setSlots((l) => {
      const next = [...l]
      if (how === 'shuffle') next.sort(() => Math.random() - 0.5)
      if (how === 'topic') next.sort((a, b) => a.pick.topicCode.localeCompare(b.pick.topicCode) || a.pick.number - b.pick.number)
      if (how === 'difficulty') next.sort((a, b) => (DIFF_ORDER[a.pick.difficulty] ?? 1) - (DIFF_ORDER[b.pick.difficulty] ?? 1))
      const half = Math.ceil(next.length / 2)
      return next.map((s, i) => ({ ...s, module: single || i < half ? 1 : 2 }))
    })

  const create = useCallback(async () => {
    setMsg(null)
    if (!title.trim()) return setMsg({ ok: false, text: 'Test nomini yozing.' })
    if (!slots.length) return setMsg({ ok: false, text: 'Savollar tanlanmagan.' })
    if (over)
      return setMsg({
        ok: false,
        text: single ? `Bir modulli testga ko‘pi bilan 44 ta savol (hozir ${slots.length}).` : `Har modulga 22 ta (hozir ${m1.length} + ${m2.length}).`,
      })
    setBusy(true)
    const order = single ? slots : [...m1, ...m2]
    const items = order.map((s) => ({
      ...(s.use === 'orig' ? { bankId: s.pick.id } : { twinId: s.use }),
      module: single ? 1 : s.module,
    }))
    const r = await fetch('/api/admin/review-mock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), layout, minutes, items }),
    }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setBusy(false)
    if (!r?.ok) return setMsg({ ok: false, text: d?.error ?? 'Yaratib bo‘lmadi.' })
    setMsg({ ok: true, text: `"${d.testLabel}" yaratildi — ${d.count} ta savol, DRAFT. «Mocklar» bo‘limida tekshirib nashr qiling.` })
    bookBasket.clear()
    setSlots([])
    setTitle('')
  }, [title, slots, over, single, m1, m2, layout, minutes])

  const column = (mod: 1 | 2, label: string) => {
    const list = single ? slots : mod === 1 ? m1 : m2
    return (
      <div className="rounded-xl border border-line bg-bg-deep/40 p-2.5">
        <div className="mb-1.5 flex items-center gap-2 px-0.5">
          <b className="text-[12px] text-ink">{label}</b>
          <span className={`text-[11px] font-bold tabular-nums ${list.length > cap ? 'text-red-600' : 'text-ink-faint'}`}>
            {list.length}/{cap}
          </span>
        </div>
        <div className="space-y-1.5">
          {list.map((s, i) => {
            const tw = twins[s.pick.id] ?? []
            return (
              <div key={s.pick.id} className="rounded-lg border border-line bg-white px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold">
                  <span className="w-5 text-ink-faint tabular-nums">{i + 1}.</span>
                  <span className="rounded-full bg-bg-deep px-2 py-0.5 text-ink-soft">
                    {s.pick.topicCode} · #{s.pick.number}
                  </span>
                  <span className="uppercase text-ink-faint">{s.pick.difficulty}</span>
                  {s.pick.type === 'gridin' && <span className="text-ink-faint">yozma</span>}
                  {s.pick.hasImage && <span className="text-ink-faint">rasmli</span>}
                  <span className="ml-auto flex items-center gap-0.5">
                    {tw.length > 0 && (
                      <select
                        className={`${inp} !px-1.5 !py-0.5 !text-[11.5px]`}
                        value={s.use}
                        onChange={(e) => patch(s.pick.id, { use: e.target.value })}
                        title="Asl savol yoki uning twini (sonlari o‘zgargan nusxasi)"
                      >
                        <option value="orig">Asl</option>
                        {tw.map((x) => (
                          <option key={x.id} value={x.id}>
                            Twin {x.variant}
                            {x.keyChecked ? ' ✓' : ' (tekshirilmagan)'}
                          </option>
                        ))}
                      </select>
                    )}
                    {!single && (
                      <button
                        type="button"
                        onClick={() => patch(s.pick.id, { module: mod === 1 ? 2 : 1 })}
                        className="rounded-md px-1.5 py-1 text-[11px] font-bold text-green-deep hover:bg-green-mist"
                        title={`${mod === 1 ? 2 : 1}-modulga ko‘chirish`}
                      >
                        {mod === 1 ? '→ M2' : '→ M1'}
                      </button>
                    )}
                    <button type="button" onClick={() => move(s.pick.id, -1)} className="rounded-md p-1 text-ink-soft hover:bg-bg-deep" aria-label="Yuqoriga">
                      <ArrowUp size={12} />
                    </button>
                    <button type="button" onClick={() => move(s.pick.id, 1)} className="rounded-md p-1 text-ink-soft hover:bg-bg-deep" aria-label="Pastga">
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => bookBasket.remove([s.pick.id])}
                      className="rounded-md p-1 text-red-500 hover:bg-red-50"
                      aria-label="Olib tashlash"
                    >
                      <X size={12} />
                    </button>
                  </span>
                </div>
                <div className="mt-1 line-clamp-2 text-[12.5px] text-ink-soft">
                  <RichText text={s.pick.preview} />
                </div>
              </div>
            )
          })}
          {!list.length && <p className="px-1 py-2 text-[12px] text-ink-faint">Bu modulda savol yo‘q.</p>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <BookOpen size={16} className="text-green" />
        <h3 className="text-[15px] font-extrabold text-ink">Kitobdan test tuzish</h3>
      </div>
      <p className="mb-3 text-[12.5px] text-ink-soft">
        «Kitob banki — ko‘rish» bo‘limida savollarni varaqlab tick qo‘ying — hammasi shu yerga yig‘iladi. Tartibini to‘g‘rilab, nom berib
        «Test yaratish»ni bosing: test DRAFT bo‘lib saqlanadi, «Mocklar»da tekshirib nashr qilasiz.
      </p>

      {!picked.length ? (
        <div className="rounded-xl border border-dashed border-line bg-bg-deep/30 p-6 text-center">
          <p className="text-[13px] text-ink-soft">Hali savol tanlanmagan.</p>
          {onBrowse && (
            <button type="button" onClick={onBrowse} className="mt-2 rounded-lg bg-green px-3.5 py-2 text-[13px] font-bold text-white">
              Kitobni varaqlashga o‘tish
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="text-[11.5px] font-bold text-ink-faint">
              Test nomi
              <input
                className={`${inp} mt-1 block w-60`}
                placeholder="SQB Statistika — 1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="text-[11.5px] font-bold text-ink-faint">
              Ko‘rinishi
              <div className="mt-1 flex gap-1">
                {(
                  [
                    ['modules', '2 modul'],
                    ['single', 'Bir modul'],
                  ] as [Layout, string][]
                ).map(([k, lab]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setLayout(k)
                      setMinutes(k === 'single' ? Math.max(minutes, 70) : Math.min(minutes, 35))
                      if (k === 'modules') {
                        const half = Math.ceil(slots.length / 2)
                        setSlots((l) => l.map((s, i) => ({ ...s, module: i < half ? 1 : 2 })))
                      }
                    }}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${layout === k ? 'bg-green text-white' : 'border border-line bg-white text-ink-soft'}`}
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-[11.5px] font-bold text-ink-faint">
              {single ? 'Jami daqiqa' : 'Modulga daqiqa'}
              <input
                type="number"
                min={1}
                max={300}
                className={`${inp} mt-1 block w-24`}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value) || 1)}
              />
            </label>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <button type="button" onClick={() => sortBy('topic')} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-bold text-ink-soft hover:text-ink">
                <SortAsc size={13} /> Mavzu bo‘yicha
              </button>
              <button type="button" onClick={() => sortBy('difficulty')} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-bold text-ink-soft hover:text-ink">
                <SortAsc size={13} /> Osondan qiyinga
              </button>
              <button type="button" onClick={() => sortBy('shuffle')} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-bold text-ink-soft hover:text-ink">
                <Shuffle size={13} /> Aralashtirish
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(picked.map((p) => p.sourceId).join('\n'))}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-bold text-ink-soft hover:text-ink"
                title="Tanlangan savollarning kitobdagi ID lari"
              >
                <Copy size={13} /> ID larni nusxalash
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Tanlangan savollar ro‘yxati tozalanadi. Davom etasizmi?')) bookBasket.clear()
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-bold text-red-500 hover:bg-red-50"
              >
                <Trash2 size={13} /> Tozalash
              </button>
            </div>
          </div>

          <div className="space-y-3">{single ? column(1, `Savollar (${slots.length})`) : (<>{column(1, 'Module 1')}{column(2, 'Module 2')}</>)}</div>

          {msg && <p className={`mt-3 text-[12.5px] font-semibold ${msg.ok ? 'text-green-deep' : 'text-red-600'}`}>{msg.text}</p>}

          <div className="sticky bottom-2 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-green bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
            <b className="text-[13px] text-ink">{slots.length} ta savol</b>
            {!single && (
              <span className="text-[12px] text-ink-faint">
                M1: {m1.length} · M2: {m2.length}
              </span>
            )}
            {over && <span className="text-[12px] font-bold text-red-600">Modul chegarasidan oshdi</span>}
            <button
              type="button"
              disabled={busy || over || !slots.length}
              onClick={create}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-green px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
            >
              {busy && <Loader2 size={13} className="animate-spin" />} Test yaratish
            </button>
            {onBrowse && (
              <button type="button" onClick={onBrowse} className="rounded-lg border border-line px-3 py-2 text-[12.5px] font-bold text-ink-soft hover:text-ink">
                ← Kitobni varaqlash
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
