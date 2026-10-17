'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Flag, Loader2, X } from 'lucide-react'
import type { Question } from '@/lib/test-data'

/** "Savolda xato bormi?" — small flag button + modal; the report shows up in the admin panel. */
export function ReportQuestionButton({
  testLabel,
  moduleLabel,
  qNumber,
  question,
  variant = 'icon',
}: {
  testLabel: string
  moduleLabel?: string
  qNumber: number
  question: Question
  /** 'icon' = small square (results screens); 'tab' = vertical tab on the left edge (computer, during the exam). */
  variant?: 'icon' | 'tab'
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)

  // A new question = a fresh report form (the thank-you state belongs to the previous question).
  const qid = question.id ?? `${moduleLabel ?? ''}:${qNumber}`
  useEffect(() => {
    setSent(false)
    setText('')
    setErr('')
    setOpen(false)
  }, [qid])

  async function send() {
    if (busy || text.trim().length < 3) return
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testLabel,
          moduleLabel,
          qNumber,
          questionId: question.id,
          prompt: (question.prompt ?? '').slice(0, 600),
          message: text,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setErr(d.error ?? 'Yuborib bo‘lmadi.')
      else setSent(true)
    } catch {
      setErr('Server bilan bog‘lanib bo‘lmadi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {variant === 'tab' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          title="Savolda xato bormi? Xabar bering"
          aria-label="Savolda xato haqida xabar berish"
          className={`group hidden lg:flex flex-col items-center gap-2 rounded-r-xl border border-l-0 px-1.5 py-3 shadow-sm transition-colors ${
            sent
              ? 'border-green-300 bg-green-50 text-green-700'
              : 'border-[#e2e8f0] bg-white/95 text-[#64748b] hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600'
          }`}
        >
          {sent ? <Check className="size-4" /> : <Flag className="size-4" />}
          <span className="text-[11.5px] font-bold tracking-wide [writing-mode:vertical-rl] rotate-180">
            {sent ? 'Yuborildi' : 'Xatosi bormi?'}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          title="Savolda xato bormi? Xabar bering"
          aria-label="Savolda xato haqida xabar berish"
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            sent ? 'border-green-300 bg-green-50 text-green-700' : 'border-[#e2e8f0] bg-white text-[#94a3b8] hover:border-orange-300 hover:text-orange-500'
          }`}
        >
          {sent ? <Check className="size-4" /> : <Flag className="size-4" />}
        </button>
      )}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl" role="dialog" aria-modal="true">
            <button onClick={() => setOpen(false)} aria-label="Yopish" className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <X className="size-4" />
            </button>
            {sent ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <Check className="size-7" />
                </div>
                <h3 className="text-lg font-extrabold text-[#0f172a]">Rahmat!</h3>
                <p className="mt-1 text-sm text-[#64748b]">Xabaringiz o‘qituvchiga yuborildi. Javob qo‘ng‘iroqchangizga keladi.</p>
                <button onClick={() => setOpen(false)} className="mt-4 h-11 w-full rounded-xl bg-[#16a34a] text-sm font-bold text-white">
                  Yopish
                </button>
              </div>
            ) : (
              <>
                <h3 className="pr-8 text-lg font-extrabold text-[#0f172a]">Savolda xato bormi?</h3>
                <p className="mt-1 text-xs text-[#64748b]">
                  {testLabel} · Q{qNumber}
                  {moduleLabel ? ` · ${moduleLabel}` : ''}
                </p>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  maxLength={1500}
                  autoFocus
                  placeholder="Nima noto‘g‘ri deb o‘ylaysiz? (masalan: javob kaliti xato, rasm ko‘rinmayapti, savol matnida xato...)"
                  className="mt-3 w-full rounded-xl border border-[#e2e8f0] p-3 text-sm outline-none focus:border-[#16a34a]"
                />
                {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
                <button
                  onClick={send}
                  disabled={busy || text.trim().length < 3}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />} Yuborish
                </button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
