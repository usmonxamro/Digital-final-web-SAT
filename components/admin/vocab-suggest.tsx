'use client'

import { useMemo, useState } from 'react'
import { Loader2, Plus, Sparkles, X } from 'lucide-react'

type Sugg = { w: string; uz: string; rec: boolean; common: boolean }
type Q = { id: string; n: number; prompt: string; existing: { w: string; uz: string }[]; suggestions: Sugg[]; unknown: string[] }
type Row = { w: string; uz: string; on: boolean; hand?: boolean; common?: boolean }

/** Per-question word picker: suggestions come from the site's word list; the admin ticks, edits, adds by hand, saves. */
export function VocabSuggest({ testLabel }: { testLabel: string }) {
  const [kind, setKind] = useState<'math' | 'reading'>('math')
  const [busy, setBusy] = useState<'load' | 'save' | null>(null)
  const [qs, setQs] = useState<Q[] | null>(null)
  const [rows, setRows] = useState<Record<string, Row[]>>({})
  const [showCommon, setShowCommon] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [addDict, setAddDict] = useState(true)

  async function load() {
    setBusy('load')
    setMsg(null)
    const r = await fetch('/api/admin/questions/suggest-vocab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: testLabel, kind }),
    }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setBusy(null)
    if (!r?.ok) {
      setMsg({ ok: false, text: d.error ?? 'Xatolik.' })
      return
    }
    const list = d.questions as Q[]
    const init: Record<string, Row[]> = {}
    for (const q of list) {
      const have = new Set(q.existing.map((e) => e.w.toLowerCase()))
      init[q.id] = [
        ...q.existing.map((e) => ({ w: e.w, uz: e.uz, on: true })),
        ...q.suggestions.filter((s) => !have.has(s.w.toLowerCase())).map((s) => ({ w: s.w, uz: s.uz, on: s.rec && q.existing.length === 0, common: s.common })),
      ]
    }
    setQs(list)
    setRows(init)
  }

  const setRow = (id: string, i: number, patch: Partial<Row>) => setRows((m) => ({ ...m, [id]: m[id].map((r, k) => (k === i ? { ...r, ...patch } : r)) }))
  const addRow = (id: string, w = '') => setRows((m) => ({ ...m, [id]: [...m[id], { w, uz: '', on: true, hand: true }] }))

  const counts = useMemo(() => {
    let on = 0
    let withVocab = 0
    for (const q of qs ?? []) {
      const c = (rows[q.id] ?? []).filter((r) => r.on && r.w.trim() && r.uz.trim()).length
      on += c
      if (c) withVocab++
    }
    return { on, withVocab }
  }, [qs, rows])

  async function save() {
    if (!qs) return
    setBusy('save')
    const items = qs.map((q) => ({ id: q.id, vocab: (rows[q.id] ?? []).filter((r) => r.on && r.w.trim() && r.uz.trim()).map((r) => ({ w: r.w.trim(), uz: r.uz.trim() })) }))
    const dictionary = addDict ? qs.flatMap((q) => (rows[q.id] ?? []).filter((r) => r.hand && r.on && r.w.trim() && r.uz.trim()).map((r) => ({ w: r.w.trim(), uz: r.uz.trim() }))) : []
    const r = await fetch('/api/admin/questions/batch-vocab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, dictionary }),
    }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setBusy(null)
    setMsg(r?.ok ? { ok: true, text: `Saqlandi: ${d.saved} ta savol${d.addedToDictionary ? `, lug'atga ${d.addedToDictionary} ta yangi so'z qo'shildi` : ''}.` } : { ok: false, text: d.error ?? 'Saqlanmadi.' })
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[12px] font-extrabold text-ink">
          <Sparkles size={13} className="text-orange-600" /> Ro‘yxatdan avto-taklif
        </span>
        <select value={kind} onChange={(e) => setKind(e.target.value as 'math' | 'reading')} className="rounded-md border border-line bg-white px-2 py-1 text-[12px] font-semibold">
          <option value="math">Math</option>
          <option value="reading">Reading &amp; Writing</option>
        </select>
        <button type="button" onClick={load} disabled={busy !== null} className="rounded-md border border-orange-300 px-3 py-1 text-[12px] font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-50">
          {busy === 'load' ? <Loader2 size={12} className="inline animate-spin" /> : qs ? 'Qayta topish' : 'So‘zlarni topish'}
        </button>
      </div>
      {msg && <p className={`mt-2 text-[12px] font-semibold ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
      {qs && (
        <>
          <div className="sticky top-0 z-10 mt-2 flex flex-wrap items-center gap-3 rounded-md border border-line bg-white/95 px-3 py-2 text-[12px]">
            <span>
              <b>{counts.on}</b> so‘z · <b>{counts.withVocab}</b> / {qs.length} savolda
            </span>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showCommon} onChange={(e) => setShowCommon(e.target.checked)} /> tez-tez uchrovchi so‘zlarni ham ko‘rsat
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={addDict} onChange={(e) => setAddDict(e.target.checked)} /> qo‘lda yozganlarimni umumiy lug‘atga ham qo‘sh
            </label>
            <button type="button" onClick={save} disabled={busy !== null} className="ml-auto rounded-md bg-orange-600 px-3 py-1 font-bold text-white hover:bg-orange-700 disabled:opacity-50">
              {busy === 'save' ? <Loader2 size={12} className="inline animate-spin" /> : 'Hammasini saqlash'}
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {qs.map((q) => (
              <div key={q.id} className="rounded-md border border-line bg-white p-2.5">
                <p className="mb-1.5 text-[12px] text-ink-soft">
                  <b className="text-ink">{q.n}.</b> {q.prompt}
                </p>
                <div className="space-y-1">
                  {(rows[q.id] ?? []).map((r, i) =>
                    r.common && !r.on && !showCommon ? null : (
                      <div key={i} className="flex items-center gap-2 text-[12px]">
                        <input type="checkbox" checked={r.on} onChange={(e) => setRow(q.id, i, { on: e.target.checked })} />
                        {r.hand ? (
                          <input value={r.w} onChange={(e) => setRow(q.id, i, { w: e.target.value })} placeholder="word" className="w-40 rounded border border-line px-1.5 py-0.5 font-semibold" />
                        ) : (
                          <span className="w-40 shrink-0 font-semibold text-ink">{r.w}</span>
                        )}
                        <input value={r.uz} onChange={(e) => setRow(q.id, i, { uz: e.target.value })} placeholder="tarjima" className="min-w-0 flex-1 rounded border border-line px-1.5 py-0.5" />
                      </div>
                    ),
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => addRow(q.id)} className="inline-flex items-center gap-0.5 rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-ink hover:bg-slate-50">
                    <Plus size={11} /> so‘z qo‘shish
                  </button>
                  {q.unknown
                    .filter((u) => !(rows[q.id] ?? []).some((r) => r.w.toLowerCase() === u))
                    .map((u) => (
                      <button key={u} type="button" onClick={() => addRow(q.id, u)} title="Lug‘atda yo‘q — bosib qo‘shing va tarjimasini yozing" className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-ink-soft hover:bg-orange-50 hover:text-orange-700">
                        <Plus size={10} /> {u}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {qs && <button type="button" onClick={() => setQs(null)} className="mt-2 inline-flex items-center gap-1 text-[11px] text-ink-faint hover:text-ink"><X size={11} /> yopish</button>}
    </div>
  )
}
