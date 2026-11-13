'use client'

import { useState } from 'react'
import { BookA, Loader2, Upload } from 'lucide-react'
import { VocabSuggest } from '@/components/admin/vocab-suggest'

type Result = {
  questions: number
  matched: number
  withoutVocab: number
  outOfRange: number[]
  format: string
  sample: { n: number; prompt: string; words: string[] }[]
  saved?: number
  failed?: number[]
  error?: string
}

/** Mock's lug‘at yuklash: paste or choose the vocabulary file (TeX / text / JSON), check, save. */
export function VocabImport({ testLabel }: { testLabel: string }) {
  const [kind, setKind] = useState<'math' | 'reading'>('math')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<'check' | 'save' | null>(null)
  const [res, setRes] = useState<Result | null>(null)
  const [done, setDone] = useState(false)

  async function send(dryRun: boolean) {
    setBusy(dryRun ? 'check' : 'save')
    setDone(false)
    const r = await fetch('/api/admin/questions/import-vocab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: testLabel, kind, text, dryRun }),
    }).catch(() => null)
    const d = (r ? await r.json().catch(() => ({})) : { error: 'Tarmoq xatosi.' }) as Result
    setBusy(null)
    setRes(r?.ok ? d : { ...(d as Result), error: d.error ?? 'Xatolik.' })
    if (r?.ok && !dryRun) setDone(true)
  }

  async function onFile(f: File | undefined) {
    if (!f) return
    setText(await f.text())
    setRes(null)
    setDone(false)
  }

  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
        <BookA size={14} className="text-orange-600" /> Lug‘at yuklash
      </div>
      <p className="mb-2 text-[11.5px] leading-relaxed text-ink-soft">
        «Lug‘atli» faylni (.tex) yoki matnni qo‘ying. Matn shakli: <code className="rounded bg-slate-100 px-1">12: word = tarjima; word2 = tarjima</code>. Savol raqamlari mockning shu bo‘limidagi savollar tartibiga to‘g‘ri keladi.
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'math' | 'reading')} className="rounded-md border border-line bg-white px-2 py-1 text-[12px] font-semibold">
          <option value="math">Math</option>
          <option value="reading">Reading &amp; Writing</option>
        </select>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-line px-2 py-1 text-[12px] font-semibold text-ink hover:bg-slate-50">
          <Upload size={12} /> Fayl tanlash
          <input type="file" accept=".tex,.txt,.json,text/plain,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setRes(null)
          setDone(false)
        }}
        rows={5}
        placeholder={'1: speed = tezlik; vehicle = transport vositasi\n2: given function = berilgan funksiya'}
        className="w-full rounded-md border border-line p-2 font-mono text-[11.5px]"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!text.trim() || busy !== null} onClick={() => send(true)} className="rounded-md border border-orange-300 px-3 py-1 text-[12px] font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-50">
          {busy === 'check' ? <Loader2 size={12} className="inline animate-spin" /> : 'Tekshirish'}
        </button>
        <button type="button" disabled={!res || !!res.error || done || busy !== null} onClick={() => send(false)} className="rounded-md bg-orange-600 px-3 py-1 text-[12px] font-bold text-white hover:bg-orange-700 disabled:opacity-50">
          {busy === 'save' ? <Loader2 size={12} className="inline animate-spin" /> : 'Saqlash'}
        </button>
      </div>
      {res?.error && <p className="mt-2 text-[12px] font-semibold text-red-600">{res.error}</p>}
      {res && !res.error && (
        <div className="mt-2 space-y-1 text-[12px] text-ink-soft">
          <p>
            <b className="text-ink">{res.matched}</b> / {res.questions} savolga lug‘at topildi
            {res.withoutVocab > 0 && ` · ${res.withoutVocab} tasida yo‘q`}
            {res.outOfRange.length > 0 && <span className="font-semibold text-red-600"> · mockda yo‘q raqamlar: {res.outOfRange.slice(0, 8).join(', ')}</span>}
          </p>
          {res.sample.map((s) => (
            <p key={s.n} className="rounded bg-slate-50 p-1.5">
              <b>{s.n}.</b> {s.prompt}… <span className="text-orange-700">→ {s.words.join('; ')}</span>
            </p>
          ))}
          {done && <p className="font-bold text-green-700">Saqlandi: {res.saved} ta savol{res.failed && res.failed.length ? `, xato: ${res.failed.join(', ')}` : ''}.</p>}
        </div>
      )}
      <VocabSuggest testLabel={testLabel} />
    </div>
  )
}
