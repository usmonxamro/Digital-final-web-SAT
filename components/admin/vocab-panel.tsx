'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RefreshCw, RotateCcw, Search, Trash2, X } from 'lucide-react'
import type { AdminVocabCandidate, AdminVocabWord } from '@/app/api/admin/vocab/route'

type View = 'words' | 'queue' | 'hidden' | 'bulk'

const CATS = ['Algebra', 'Geometriya', 'Statistika', 'Matn masalalari', "Fe'llar", 'Iboralar', "O'lchov birliklari", 'Umumiy']
const btn = 'px-3 py-1.5 rounded-lg text-[12.5px] font-bold border border-line hover:bg-slate-50 disabled:opacity-50'
const btnPrimary = 'px-3 py-1.5 rounded-lg text-[12.5px] font-bold bg-green text-white hover:brightness-110 disabled:opacity-50'
const input = 'w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13.5px] outline-none focus:border-green'

async function api(method: string, body?: unknown, path = '/api/admin/vocab') {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const d = await res.json().catch(() => ({}))
  return { ok: res.ok, d }
}

/**
 * Admin "Lug'atlar": so'zni joyida tahrirlash (yozib, boshqa joyga bosilganda saqlanadi), bir bosishda yashirish (butunlay o'chirmasdan —
 * "Yashirinlar" ro'yxatidan tiklash yoki butunlay o'chirish mumkin), yangi so'z qo'shish, ko'plab so'zlarni birdan qo'shish
 * va yangi mocklardan topilgan, tarjimasi kutilayotgan so'zlar navbati.
 */
export function VocabPanel() {
  const [words, setWords] = useState<AdminVocabWord[]>([])
  const [queue, setQueue] = useState<AdminVocabCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [view, setView] = useState<View>('words')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [onlyReview, setOnlyReview] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [limit, setLimit] = useState(60)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/vocab', { cache: 'no-store' })
      const d = await res.json()
      if (d.error) setError(d.error)
      setWords(d.words ?? [])
      setQueue(d.candidates ?? [])
    } catch {
      setError("Server bilan bog'lanib bo'lmadi.")
    }
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const flash = (t: string) => {
    setMsg(t)
    setTimeout(() => setMsg(null), 3500)
  }

  const patch = async (id: number, fields: Partial<AdminVocabWord>) => {
    setWords((ws) => ws.map((w) => (w.id === id ? { ...w, ...fields, ...('uz' in fields ? { needs_review: false } : {}) } : w)))
    const { ok, d } = await api('PATCH', { id, ...fields })
    if (!ok) {
      setError(d.error ?? "Saqlab bo'lmadi.")
      load()
    }
  }
  const hardDelete = async (id: number) => {
    if (!window.confirm("Butunlay o'chirilsinmi? Qaytarib bo'lmaydi (o'quvchilarning shu so'z bo'yicha natijalari ham o'chadi).")) return
    setWords((ws) => ws.filter((w) => w.id !== id))
    await api('DELETE', { id })
  }

  const scan = async () => {
    setScanning(true)
    setError(null)
    const { ok, d } = await api('POST', undefined, '/api/admin/vocab/scan')
    setScanning(false)
    if (!ok) return setError(d.error ?? "Skanerlab bo'lmadi.")
    flash(`${d.questions} ta savol ko'rib chiqildi: ${d.examplesAdded} ta so'zga misol gap topildi, ${d.candidates} ta yangi so'z navbatda.`)
    load()
  }

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return words.filter((w) => {
      if (view === 'hidden' ? w.active : !w.active) return false
      if (cat && w.cat !== cat) return false
      if (onlyReview && !w.needs_review) return false
      if (needle && !(w.en + ' ' + w.uz).toLowerCase().includes(needle)) return false
      return true
    })
  }, [words, view, q, cat, onlyReview])

  const active = words.filter((w) => w.active).length
  const hidden = words.length - active
  const reviewCount = words.filter((w) => w.active && w.needs_review).length

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(
          [
            ['words', `So'zlar (${active})`],
            ['queue', `Tarjima kutayotganlar (${queue.length})`],
            ['bulk', "Ko'plab qo'shish"],
            ['hidden', `Yashirinlar (${hidden})`],
          ] as [View, string][]
        ).map(([k, label]) => (
          <button key={k} className={`${btn} ${view === k ? 'bg-green-mist border-green text-green-deep' : ''}`} onClick={() => setView(k)}>
            {label}
          </button>
        ))}
        <span className="flex-1" />
        <button className={btn} onClick={scan} disabled={scanning} title="Mock savollaridan misol gaplarni topadi va yangi so'zlarni navbatga qo'shadi">
          {scanning ? <Loader2 size={13} className="inline animate-spin" /> : <RefreshCw size={13} className="inline" />} Mocklardan skanerlash
        </button>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px] px-3 py-2">{error}</div>}
      {msg && <div className="mb-3 rounded-lg bg-green-mist border border-green text-green-deep text-[13px] px-3 py-2">{msg}</div>}
      {loading && <div className="text-[13px] text-ink-soft mb-2">Yuklanmoqda…</div>}

      {(view === 'words' || view === 'hidden') && (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <label className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-2.5 top-2.5 text-ink-soft" />
              <input className={`${input} pl-8`} placeholder="Qidirish (inglizcha yoki o'zbekcha)…" value={q} onChange={(e) => (setQ(e.target.value), setLimit(60))} />
            </label>
            <select className={`${input} !w-auto`} value={cat} onChange={(e) => (setCat(e.target.value), setLimit(60))}>
              <option value="">Barcha bo'limlar</option>
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {view === 'words' && (
              <button className={`${btn} ${onlyReview ? 'bg-yellow-50 border-yellow-400' : ''}`} onClick={() => setOnlyReview((v) => !v)}>
                ⚠ Tekshirish kerak ({reviewCount})
              </button>
            )}
          </div>

          {view === 'words' && <AddForm onAdded={(w) => setWords((ws) => [...ws, w])} onError={setError} />}

          <div className="rounded-xl border border-line overflow-hidden">
            {visible.slice(0, limit).map((w) => (
              <Row key={w.id} w={w} onPatch={patch} onHardDelete={hardDelete} />
            ))}
            {!visible.length && <div className="p-4 text-[13px] text-ink-soft">Hech narsa topilmadi.</div>}
          </div>
          {visible.length > limit && (
            <button className={`${btn} mt-3`} onClick={() => setLimit((n) => n + 100)}>
              Yana ko'rsatish ({visible.length - limit})
            </button>
          )}
        </>
      )}

      {view === 'queue' && <Queue items={queue} onChanged={load} onError={setError} />}
      {view === 'bulk' && <Bulk onDone={(t) => (flash(t), load(), setView('words'))} onError={setError} />}
    </div>
  )
}

function Row({
  w,
  onPatch,
  onHardDelete,
}: {
  w: AdminVocabWord
  onPatch: (id: number, f: Partial<AdminVocabWord>) => void
  onHardDelete: (id: number) => void
}) {
  const [en, setEn] = useState(w.en)
  const [uz, setUz] = useState(w.uz)
  const [open, setOpen] = useState(false)
  const [ex, setEx] = useState(w.example ?? '')
  return (
    <div className={`px-3 py-2 border-b border-line last:border-b-0 ${w.needs_review && w.active ? 'bg-yellow-50' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${input} !w-[34%] min-w-[140px] font-bold`} value={en} onChange={(e) => setEn(e.target.value)} onBlur={() => en.trim() && en !== w.en && onPatch(w.id, { en })} />
        <input className={`${input} flex-1 min-w-[180px]`} value={uz} onChange={(e) => setUz(e.target.value)} onBlur={() => uz.trim() && uz !== w.uz && onPatch(w.id, { uz })} />
        <select className={`${input} !w-auto`} value={w.cat} onChange={(e) => onPatch(w.id, { cat: e.target.value })}>
          {[...new Set([...CATS, w.cat])].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className={btn} onClick={() => setOpen((v) => !v)} title="Misol gap (gap-to'ldirish quizi uchun)">
          {w.example ? '✎ misol' : '+ misol'}
        </button>
        {w.active ? (
          <button className={`${btn} text-red-600`} onClick={() => onPatch(w.id, { active: false })} title="Yashirish (quiz va botdan olib tashlanadi)">
            <Trash2 size={14} className="inline" />
          </button>
        ) : (
          <>
            <button className={btn} onClick={() => onPatch(w.id, { active: true })}>
              <RotateCcw size={13} className="inline" /> Tiklash
            </button>
            <button className={`${btn} text-red-600`} onClick={() => onHardDelete(w.id)}>
              Butunlay o'chirish
            </button>
          </>
        )}
      </div>
      {w.needs_review && w.active && (
        <div className="mt-1 text-[11.5px] text-yellow-700 flex items-center gap-2">
          ⚠ Tarjimasini tekshirib ko'ring.
          <button className="underline font-bold" onClick={() => onPatch(w.id, { needs_review: false })}>
            To'g'ri, belgini olib tashlash
          </button>
        </div>
      )}
      {open && (
        <div className="mt-2 flex gap-2">
          <input className={input} placeholder="Savol matnidan inglizcha gap (so'z shu gapda bo'lishi kerak)" value={ex} onChange={(e) => setEx(e.target.value)} />
          <button className={btnPrimary} onClick={() => (onPatch(w.id, { example: ex.trim() || null }), setOpen(false))}>
            Saqlash
          </button>
        </div>
      )}
    </div>
  )
}

function AddForm({ onAdded, onError }: { onAdded: (w: AdminVocabWord) => void; onError: (e: string | null) => void }) {
  const [en, setEn] = useState('')
  const [uz, setUz] = useState('')
  const [cat, setCat] = useState('Umumiy')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!en.trim() || !uz.trim()) return
    setBusy(true)
    onError(null)
    const { ok, d } = await api('POST', { en, uz, cat })
    setBusy(false)
    if (!ok) return onError(d.error ?? "Saqlab bo'lmadi.")
    onAdded(d.word)
    setEn('')
    setUz('')
  }
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 p-2.5 rounded-xl bg-slate-50 border border-line">
      <input className={`${input} !w-[30%] min-w-[130px]`} placeholder="English" value={en} onChange={(e) => setEn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <input className={`${input} flex-1 min-w-[160px]`} placeholder="O'zbekcha tarjima" value={uz} onChange={(e) => setUz(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <select className={`${input} !w-auto`} value={cat} onChange={(e) => setCat(e.target.value)}>
        {CATS.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <button className={btnPrimary} onClick={submit} disabled={busy || !en.trim() || !uz.trim()}>
        <Plus size={14} className="inline" /> Qo'shish
      </button>
    </div>
  )
}

function Queue({ items, onChanged, onError }: { items: AdminVocabCandidate[]; onChanged: () => void; onError: (e: string | null) => void }) {
  const [uz, setUz] = useState<Record<string, string>>({})
  const [cat, setCat] = useState<Record<string, string>>({})
  if (!items.length)
    return <div className="text-[13px] text-ink-soft p-3">Hozircha navbat bo'sh. Yangi mock qo'shilganda (yoki «Mocklardan skanerlash» bosilganda) lug'atda yo'q, lekin savollarda ko'p uchraydigan so'zlar shu yerga tushadi.</div>
  return (
    <div className="rounded-xl border border-line overflow-hidden">
      {items.map((c) => (
        <div key={c.word} className="px-3 py-2 border-b border-line last:border-b-0">
          <div className="flex flex-wrap items-center gap-2">
            <b className="min-w-[110px] text-[14px]">{c.word}</b>
            <span className="text-[11.5px] text-ink-soft">{c.docs} ta savolda</span>
            <input className={`${input} flex-1 min-w-[160px]`} placeholder="O'zbekcha tarjima" value={uz[c.word] ?? ''} onChange={(e) => setUz({ ...uz, [c.word]: e.target.value })} />
            <select className={`${input} !w-auto`} value={cat[c.word] ?? 'Umumiy'} onChange={(e) => setCat({ ...cat, [c.word]: e.target.value })}>
              {CATS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <button
              className={btnPrimary}
              disabled={!(uz[c.word] ?? '').trim()}
              onClick={async () => {
                const { ok, d } = await api('POST', { en: c.word, uz: uz[c.word], cat: cat[c.word] ?? 'Umumiy', fromCandidate: c.word })
                if (!ok && d.error && !/allaqachon/.test(d.error)) return onError(d.error)
                onChanged()
              }}
            >
              Qo'shish
            </button>
            <button
              className={btn}
              title="Kerak emas (ro'yxatga qaytmaydi)"
              onClick={async () => {
                await api('PATCH', { candidate: c.word })
                onChanged()
              }}
            >
              <X size={14} className="inline" />
            </button>
          </div>
          {c.example && <div className="mt-1 text-[12px] text-ink-soft italic">“{c.example}”</div>}
        </div>
      ))}
    </div>
  )
}

function Bulk({ onDone, onError }: { onDone: (t: string) => void; onError: (e: string | null) => void }) {
  const [text, setText] = useState('')
  const [cat, setCat] = useState('Umumiy')
  const [busy, setBusy] = useState(false)
  return (
    <div>
      <p className="text-[13px] text-ink-soft mb-2">Har qatorga bitta so'z: <code>english [TAB] o'zbekcha</code> (yoki <code>english = o'zbekcha</code>). Bor so'zlarga tegilmaydi.</p>
      <textarea className={`${input} h-56 font-mono`} value={text} onChange={(e) => setText(e.target.value)} placeholder={'slope\tqiyalik\nparabola = parabola'} />
      <div className="flex gap-2 mt-2">
        <select className={`${input} !w-auto`} value={cat} onChange={(e) => setCat(e.target.value)}>
          {CATS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          className={btnPrimary}
          disabled={busy || !text.trim()}
          onClick={async () => {
            setBusy(true)
            onError(null)
            const { ok, d } = await api('POST', { bulk: text, cat })
            setBusy(false)
            if (!ok) return onError(d.error ?? "Saqlab bo'lmadi.")
            onDone(`${d.added} ta so'z qo'shildi, ${d.skipped} tasi allaqachon bor edi.`)
          }}
        >
          Qo'shish
        </button>
      </div>
    </div>
  )
}
