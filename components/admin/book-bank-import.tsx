'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, CheckCircle2, Loader2, UploadCloud } from 'lucide-react'
import type { BankStatus } from '@/lib/question-bank-import'

/** Admin: loads the book's 1925 questions (4 sections, answer keys and SVG figures included) into `question_bank`. */
export function BookBankImport() {
  const [st, setSt] = useState<BankStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [skip, setSkip] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/question-bank')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Xatolik')
      setSt(d)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik')
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function run(keys: string[]) {
    setMsg(null)
    setError(null)
    let total = 0
    try {
      for (const k of keys) {
        setBusy(k)
        const r = await fetch('/api/admin/question-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: k, skipNeedsCheck: skip }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Xatolik')
        total += d.imported
      }
      setMsg(`${total} ta savol bazaga yozildi.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik')
    } finally {
      setBusy(null)
      load()
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <BookOpen size={17} className="text-green" />
        <h3 className="text-[15px] font-extrabold text-ink">Kitob banki (1925 savol)</h3>
      </div>
      <p className="mb-4 text-[12.5px] text-ink-soft">
        Savollar, to‘g‘ri javoblar va chizmalar (SVG) 4 bo‘lim bo‘yicha alohida «question_bank» jadvaliga tushadi — mock va skill-drill larga aralashmaydi.
        Tugmani qayta bossangiz dublikat bo‘lmaydi, yangilanadi.
      </p>

      {st?.tableMissing && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12.5px] text-amber-900">
          Jadval hali yo‘q. Supabase → SQL Editor’da <b>supabase/question_bank.sql</b> faylini bir marta Run qiling, keyin bu sahifani yangilang.
        </div>
      )}
      {error && <p className="mb-3 text-[12.5px] text-red-600">{error}</p>}
      {msg && (
        <p className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-green-deep">
          <CheckCircle2 size={14} /> {msg}
        </p>
      )}

      {!st && !error && (
        <div className="flex items-center gap-2 py-4 text-[13px] text-ink-faint">
          <Loader2 size={15} className="animate-spin" /> Yuklanmoqda...
        </div>
      )}

      {st && (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {st.domains.map((d) => {
              const done = d.inDb >= d.inFile
              return (
                <div key={d.key} className="rounded-xl border border-line bg-bg p-3.5">
                  <div className="text-[13.5px] font-extrabold text-ink">{d.label}</div>
                  <div className="mt-0.5 text-[12px] text-ink-soft">
                    Bazada: <b className={done ? 'text-green-deep' : 'text-ink'}>{d.inDb}</b> / {d.inFile}
                    {d.needsCheck > 0 && <span className="text-ink-faint"> · {d.needsCheck} tasi «tekshirish kerak»</span>}
                  </div>
                  <button
                    type="button"
                    disabled={!!busy || st.tableMissing}
                    onClick={() => run([d.key])}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-green px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50"
                  >
                    {busy === d.key ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                    {done ? 'Qayta yuklash' : 'Yuklash'}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!!busy || st.tableMissing}
              onClick={() => run(st.domains.map((d) => d.key))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-green px-3.5 py-2 text-[13px] font-bold text-green-deep disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Hammasini yuklash
            </button>
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
              <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> «Tekshirish kerak» savollarni o‘tkazib yuborish
            </label>
          </div>
        </>
      )}
    </div>
  )
}
