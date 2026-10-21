'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, Loader2, Search, X } from 'lucide-react'

export type PickedBotTest = { code: string; name: string | null; kind: string | null; questionCount: number; testLabel: string | null }

/**
 * "Botdan tanlash": a searchable list of the tests that already exist in the Telegram bot. Picking one means
 * "this mock is that bot test": its answer key is copied onto the new mock, so nothing has to be typed in again.
 */
export function BotTestPicker({
  onPick,
  expectedCount,
}: {
  onPick: (t: PickedBotTest) => void
  /** If set, tests with a different number of answers are shown greyed out (their key cannot be applied). */
  expectedCount?: number
}) {
  const [open, setOpen] = useState(false)
  const [tests, setTests] = useState<PickedBotTest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open || tests) return
    fetch('/api/admin/bot-sync?light=1', { cache: 'no-store' })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setTests(d.tests) : setError(d.error ?? 'Botdagi testlarni yuklab bo‘lmadi.')))
      .catch(() => setError("Server bilan bog'lanib bo'lmadi."))
  }, [open, tests])

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return (tests ?? []).filter((t) => !n || `${t.name ?? ''} ${t.code}`.toLowerCase().includes(n))
  }, [tests, q])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-[9px] border border-line text-[12.5px] font-bold text-ink-soft hover:border-green"
      >
        <Bot size={14} /> Botdan tanlash
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 p-4 border-b border-line">
              <div className="font-extrabold text-[15px]">Botdagi testni tanlang</div>
              <button onClick={() => setOpen(false)} className="ml-auto text-ink-faint hover:text-ink"><X size={18} /></button>
            </div>
            <div className="p-3 border-b border-line relative">
              <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nomi yoki kodi bo'yicha qidirish…"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-line text-[13px] focus:outline-none focus:border-green"
              />
            </div>
            <div className="overflow-y-auto p-2">
              {!tests && !error && <div className="p-4 text-[13px] text-ink-faint flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Yuklanmoqda…</div>}
              {error && <div className="p-4 text-[13px] text-red-600">{error}</div>}
              {shown.map((t) => {
                const mismatch = expectedCount != null && t.questionCount !== expectedCount
                return (
                  <button
                    key={t.code}
                    type="button"
                    disabled={mismatch}
                    onClick={() => { onPick(t); setOpen(false) }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="text-[13.5px] font-bold">{t.name ?? t.code}</div>
                    <div className="text-[11.5px] text-ink-faint">
                      kod: {t.code} · {t.questionCount} ta javob
                      {mismatch ? ` (bu mockda ${expectedCount} ta savol kerak)` : ''}
                      {t.testLabel ? ` · allaqachon saytda: ${t.testLabel}` : ''}
                    </div>
                  </button>
                )
              })}
              {tests && shown.length === 0 && <div className="p-4 text-[13px] text-ink-faint">Hech narsa topilmadi.</div>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
