'use client'

import { useMemo, useState } from 'react'
import { Check, EyeOff, Loader2, Plus, Sparkles } from 'lucide-react'

type Sugg = { w: string; uz: string; rec: boolean; common: boolean; learned?: 'liked' | 'rejected' }
type Q = { id: string; n: number; prompt: string; existing: { w: string; uz: string }[]; suggestions: Sugg[]; unknown: string[] }
/** One word under one question. `orig*` = the state last loaded/saved, so the page knows exactly what changed. */
type Row = { w: string; uz: string; on: boolean; origUz: string; origOn: boolean; fromDict: boolean; rec: boolean; hand?: boolean; hide?: boolean; common?: boolean; learned?: Sugg['learned'] }

const clean = (rs: Row[]) => rs.filter((r) => r.on && !r.hide && r.w.trim() && r.uz.trim()).map((r) => ({ w: r.w.trim(), uz: r.uz.trim() }))
const sig = (rs: Row[]) => JSON.stringify(clean(rs))

/** Per-question word picker. Suggestions come from the site's word list; every correction is remembered and sent back to it. */
export function VocabSuggest({ testLabel }: { testLabel: string }) {
  const [kind, setKind] = useState<'math' | 'reading'>('math')
  const [busy, setBusy] = useState<'load' | 'save' | null>(null)
  const [qs, setQs] = useState<Q[] | null>(null)
  const [rows, setRows] = useState<Record<string, Row[]>>({})
  const [base, setBase] = useState<Record<string, string>>({})
  const [showCommon, setShowCommon] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; lines: string[] } | null>(null)
  const [learning, setLearning] = useState(true)

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
      setMsg({ ok: false, lines: [d.error ?? 'Xatolik.'] })
      return
    }
    const list = d.questions as Q[]
    setLearning(d.learning !== false)
    const init: Record<string, Row[]> = {}
    const b: Record<string, string> = {}
    for (const q of list) {
      const have = new Set(q.existing.map((e) => e.w.toLowerCase()))
      init[q.id] = [
        ...q.existing.map((e) => ({ w: e.w, uz: e.uz, on: true, origUz: e.uz, origOn: true, fromDict: false, rec: true })),
        ...q.suggestions
          .filter((s) => !have.has(s.w.toLowerCase()))
          .map((s) => {
            const on = s.rec && q.existing.length === 0
            return { w: s.w, uz: s.uz, on, origUz: s.uz, origOn: on, fromDict: true, rec: s.rec, common: s.common, learned: s.learned }
          }),
      ]
      b[q.id] = q.existing.length ? JSON.stringify(q.existing.map((e) => ({ w: e.w, uz: e.uz }))) : '[]'
    }
    setQs(list)
    setRows(init)
    setBase(b)
  }

  const setRow = (id: string, i: number, patch: Partial<Row>) => setRows((m) => ({ ...m, [id]: m[id].map((r, k) => (k === i ? { ...r, ...patch } : r)) }))
  const addRow = (id: string, w = '') => setRows((m) => ({ ...m, [id]: [...m[id], { w, uz: '', on: true, origUz: '', origOn: false, fromDict: false, rec: false, hand: true }] }))

  /** What a click on "save" would change — shown live, so it is always clear whether anything is waiting to be sent. */
  const pending = useMemo(() => {
    const changedQs = (qs ?? []).filter((q) => sig(rows[q.id] ?? []) !== base[q.id])
    let corrections = 0
    let fresh = 0
    let hides = 0
    for (const q of qs ?? [])
      for (const r of rows[q.id] ?? []) {
        if (r.hide) hides++
        else if (r.on && r.w.trim() && r.uz.trim()) {
          if (r.hand && r.origUz === '') fresh++
          else if (r.uz.trim() !== r.origUz.trim()) corrections++
        }
      }
    const total = (qs ?? []).reduce((a, q) => a + clean(rows[q.id] ?? []).length, 0)
    return { changedQs, corrections, fresh, hides, total, any: changedQs.length + corrections + fresh + hides > 0 }
  }, [qs, rows, base])

  async function save() {
    if (!qs || !pending.any) return
    setBusy('save')
    const items = pending.changedQs.map((q) => ({ id: q.id, vocab: clean(rows[q.id]) }))
    const dictionary: { w: string; uz: string }[] = []
    const picked: string[] = []
    const skipped: string[] = []
    const hide: string[] = []
    for (const q of qs)
      for (const r of rows[q.id] ?? []) {
        if (r.hide) {
          hide.push(r.w)
          continue
        }
        if (r.on && r.w.trim() && r.uz.trim() && (r.hand || r.uz.trim() !== r.origUz.trim())) dictionary.push({ w: r.w.trim(), uz: r.uz.trim() })
        if (r.fromDict && r.on !== r.origOn) {
          if (r.on && !r.rec) picked.push(r.w) // admin deliberately added a word we did not tick
          if (!r.on && r.rec) skipped.push(r.w) // admin removed a word we ticked
        }
      }
    const r = await fetch('/api/admin/questions/batch-vocab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, dictionary, feedback: { picked, skipped, hide } }),
    }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setBusy(null)
    if (!r?.ok) {
      setMsg({ ok: false, lines: [d.error ?? 'Saqlanmadi.', 'Bazaga hech narsa yozilmadi.'] })
      return
    }
    // the saved state becomes the new baseline: nothing is "pending" until the next edit
    setBase((b) => ({ ...b, ...Object.fromEntries(pending.changedQs.map((q) => [q.id, sig(rows[q.id])])) }))
    setRows((m) =>
      Object.fromEntries(
        Object.entries(m).map(([id, rs]) => [
          id,
          rs.filter((x) => !x.hide).map((x) => ({ ...x, origUz: x.on ? x.uz.trim() : x.origUz, origOn: x.on, hand: false, fromDict: x.fromDict || (x.on && !!x.uz.trim()) })),
        ]),
      ),
    )
    const lines = [`✔ Bazaga yuborildi: ${d.saved} ta savol yangilandi.`]
    if (d.correctedInDictionary) lines.push(`✔ Lug'atda ${d.correctedInDictionary} ta tarjima tuzatildi (keyingi mocklarda shu holda taklif qilinadi).`)
    if (d.addedToDictionary) lines.push(`✔ Lug'atga ${d.addedToDictionary} ta yangi so'z qo'shildi.`)
    if (d.learned) lines.push(`✔ Tanlovlaringiz eslab qolindi (${d.learned} ta so'z).`)
    else if ((picked.length || skipped.length || hide.length) && d.learningOn === false) lines.push(`ℹ O'rganish o'chiq: Supabase'da v115_vocab_learning.sql ni ishga tushirsangiz tanlovlaringiz ham eslab qolinadi.`)
    if (d.failed?.length) lines.push(`⚠ ${d.failed.length} ta savol saqlanmadi.`)
    setMsg({ ok: true, lines })
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
        <button type="button" onClick={load} disabled={busy !== null || pending.any} title={pending.any ? 'Avval saqlang' : ''} className="rounded-md border border-orange-300 px-3 py-1 text-[12px] font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-50">
          {busy === 'load' ? <Loader2 size={12} className="inline animate-spin" /> : qs ? 'Qayta topish' : 'So‘zlarni topish'}
        </button>
      </div>
      {msg && (
        <div className={`mt-2 space-y-0.5 text-[12px] font-semibold ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>
          {msg.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      )}
      {qs && (
        <>
          <div className="sticky top-0 z-10 mt-2 flex flex-wrap items-center gap-3 rounded-md border border-line bg-white/95 px-3 py-2 text-[12px]">
            <span>
              <b>{pending.total}</b> so‘z · <b>{qs.filter((q) => clean(rows[q.id] ?? []).length).length}</b> / {qs.length} savolda
            </span>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showCommon} onChange={(e) => setShowCommon(e.target.checked)} /> tez-tez uchrovchi so‘zlarni ham ko‘rsat
            </label>
            {!learning && <span className="text-ink-faint">o‘rganish o‘chiq (v115)</span>}
            <span className={`ml-auto font-bold ${pending.any ? 'text-orange-700' : 'text-green-700'}`}>
              {pending.any
                ? `Saqlanmagan: ${pending.changedQs.length} savol${pending.corrections ? `, ${pending.corrections} tarjima tuzatish` : ''}${pending.fresh ? `, ${pending.fresh} yangi so‘z` : ''}${pending.hides ? `, ${pending.hides} ta yashirish` : ''}`
                : 'O‘zgarish yo‘q — bazaga hech narsa yuborilmaydi'}
            </span>
            <button type="button" onClick={save} disabled={busy !== null || !pending.any} className="rounded-md bg-orange-600 px-3 py-1 font-bold text-white hover:bg-orange-700 disabled:opacity-40">
              {busy === 'save' ? <Loader2 size={12} className="inline animate-spin" /> : 'Saqlash'}
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {qs.map((q) => {
              const dirty = sig(rows[q.id] ?? []) !== base[q.id]
              return (
                <div key={q.id} className={`rounded-md border bg-white p-2.5 ${dirty ? 'border-orange-300' : 'border-line'}`}>
                  <p className="mb-1.5 text-[12px] text-ink-soft">
                    <b className="text-ink">{q.n}.</b> {q.prompt} {!dirty && base[q.id] !== '[]' && <Check size={12} className="inline text-green-600" />}
                  </p>
                  <div className="space-y-1">
                    {(rows[q.id] ?? []).map((r, i) =>
                      (r.common || r.learned === 'rejected') && !r.on && !showCommon ? null : r.hide ? null : (
                        <div key={i} className="flex items-center gap-2 text-[12px]">
                          <input type="checkbox" checked={r.on} onChange={(e) => setRow(q.id, i, { on: e.target.checked })} />
                          {r.hand ? (
                            <input value={r.w} onChange={(e) => setRow(q.id, i, { w: e.target.value })} placeholder="word" className="w-40 rounded border border-line px-1.5 py-0.5 font-semibold" />
                          ) : (
                            <span className="w-40 shrink-0 font-semibold text-ink">
                              {r.w}
                              {r.learned === 'liked' && <span title="Ko‘p tanlagansiz" className="ml-1 text-orange-600">★</span>}
                            </span>
                          )}
                          <input
                            value={r.uz}
                            onChange={(e) => setRow(q.id, i, { uz: e.target.value })}
                            placeholder="tarjima"
                            className={`min-w-0 flex-1 rounded border px-1.5 py-0.5 ${r.uz.trim() !== r.origUz.trim() ? 'border-orange-400 bg-orange-50' : 'border-line'}`}
                          />
                          {r.fromDict && (
                            <button type="button" onClick={() => setRow(q.id, i, { hide: true, on: false })} title="Bu so‘zni savol lug‘atlarida boshqa taklif qilma (quizda qoladi)" className="text-ink-faint hover:text-red-600">
                              <EyeOff size={13} />
                            </button>
                          )}
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
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
