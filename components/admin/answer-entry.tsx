'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Pencil, UploadCloud, Undo2 } from 'lucide-react'
import type { ChoiceId, Question } from '@/lib/test-data'
import { useUnsavedChanges } from '@/lib/admin-unsaved'

type QuestionWithId = Question & { id: string }
type LocalAnswer = { correct?: ChoiceId; correctValue?: string }
type Answers = Record<string, LocalAnswer>

export type AnswerSection = {
  key: string
  /** Heading shown above the section (omit for a single, unlabeled section). */
  label?: string
  questions: QuestionWithId[]
}

function isAnswered(q: QuestionWithId, a?: LocalAnswer) {
  return q.type === 'gridin' ? !!a?.correctValue?.trim() : !!a?.correct
}

/**
 * Bulk, blind answer-sheet entry — every question's answer is picked locally
 * (no network call per click), and the WHOLE sheet (every module shown on the
 * page) is submitted in ONE request when the admin presses the save button.
 *
 * Layout: each module is its own block, all visible at once (scroll down to
 * reach the next module — nothing hidden behind tabs, so nothing is lost or
 * sent early when moving between modules). Inside a module the numbers run
 * VERTICALLY in two columns: 1–11 down the left, 12–22 down the right.
 *
 * After a successful save the sheet "completes": every row dims, a "tayyor"
 * banner + bottom toast appear, and a pencil button reopens the whole mock
 * for editing; re-saving sends the full sheet again, in place.
 */
export function AnswerSheet({
  sections,
  onSaved,
  raised,
}: {
  sections: AnswerSection[]
  onSaved?: (updated: QuestionWithId) => void
  /** Lift the sticky bar / toast above a floating bar at the screen bottom (Publish). */
  raised?: boolean
}) {
  const allQuestions = useMemo(() => sections.flatMap((s) => s.questions), [sections])

  const [answers, setAnswers] = useState<Answers>(() => {
    const init: Answers = {}
    allQuestions.forEach((q) => {
      init[q.id] = { correct: q.correct, correctValue: q.correctValue }
    })
    return init
  })
  // Last state known to be on the server — used for "changed?" and "cancel".
  const [savedSnapshot, setSavedSnapshot] = useState<Answers | null>(null)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rescored, setRescored] = useState(0)
  const [notified, setNotified] = useState(0)
  /** How many answers the last save actually changed (null = nothing saved yet). */
  const [changedCount, setChangedCount] = useState<number | null>(null)
  // What the server had when the sheet opened — only real changes are sent, nothing else is touched.
  const [initial] = useState<Answers>(() => JSON.parse(JSON.stringify(answers)))
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const answeredCount = useMemo(
    () => allQuestions.filter((q) => isAnswered(q, answers[q.id])).length,
    [allQuestions, answers],
  )
  const unanswered = allQuestions.length - answeredCount

  const dirty = useMemo(() => {
    if (!savedSnapshot) return true
    return allQuestions.some((q) => {
      const a = answers[q.id]
      const s = savedSnapshot[q.id]
      return (a?.correct ?? '') !== (s?.correct ?? '') || (a?.correctValue?.trim() ?? '') !== (s?.correctValue?.trim() ?? '')
    })
  }, [allQuestions, answers, savedSnapshot])

  // Answers changed on screen but not written to the server yet (against what the server has now).
  const pending = useMemo(() => {
    const base = savedSnapshot ?? initial
    return allQuestions.filter((q) => {
      const a = answers[q.id]
      const b = base[q.id]
      return q.type === 'gridin'
        ? (a?.correctValue?.trim() ?? '') !== (b?.correctValue?.trim() ?? '')
        : (a?.correct ?? '') !== (b?.correct ?? '')
    }).length
  }, [allQuestions, answers, savedSnapshot, initial])
  const sheetId = useId()
  useUnsavedChanges(`answers-${sheetId}`, pending, `Javoblar: ${pending} ta javob o'zgargan, hali saqlanmagan`)

  function setChoice(id: string, choice: ChoiceId) {
    if (done) return
    setAnswers((m) => ({ ...m, [id]: { correct: choice } }))
  }
  function setGrid(id: string, value: string) {
    if (done) return
    setAnswers((m) => ({ ...m, [id]: { correctValue: value } }))
  }

  async function submitAll() {
    setSaving(true)
    setError(null)
    const base = savedSnapshot ?? initial
    const same = (q: QuestionWithId) => {
      const a = answers[q.id]
      const b = base[q.id]
      return q.type === 'gridin' ? (a?.correctValue?.trim() ?? '') === (b?.correctValue?.trim() ?? '') : (a?.correct ?? '') === (b?.correct ?? '')
    }
    const changedQs = allQuestions.filter((q) => !same(q))
    if (changedQs.length === 0) {
      // Nothing to write: say so plainly instead of pretending something was saved.
      setChangedCount(0)
      setSavedSnapshot(JSON.parse(JSON.stringify(answers)))
      setRescored(0)
      setNotified(0)
      setDone(true)
      setSaving(false)
      return
    }
    const payload = changedQs.map((q) => {
      const a = answers[q.id]
      return q.type === 'gridin'
        ? { id: q.id, correctValue: a?.correctValue?.trim() || undefined }
        : { id: q.id, correct: a?.correct }
    })
    try {
      const res = await fetch('/api/admin/questions/batch-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Saqlashda xatolik yuz berdi.')
        return
      }
      allQuestions.forEach((q) => {
        const a = answers[q.id]
        onSaved?.({ ...q, correct: a?.correct, correctValue: a?.correctValue?.trim() || undefined })
      })
      setSavedSnapshot(JSON.parse(JSON.stringify(answers)))
      setChangedCount(changedQs.length)
      setRescored(data.rescored ?? 0)
      setNotified(data.notified ?? 0)
      setDone(true)
      setToastVisible(true)
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToastVisible(false), 4000)
    } catch {
      setError("Server bilan bog'lanib bo'lmadi.")
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    if (savedSnapshot) setAnswers(JSON.parse(JSON.stringify(savedSnapshot)))
    setError(null)
    setDone(true)
  }

  function renderRow(q: QuestionWithId, num: number) {
    const a = answers[q.id]
    return (
      <div
        key={q.id}
        className="flex items-center gap-2.5 border border-line rounded-lg px-3 py-2 bg-bg transition-colors"
      >
        <span className="w-6 text-[12.5px] font-bold text-ink-soft shrink-0 text-right">{num}.</span>
        {q.type === 'gridin' ? (
          <input
            value={a?.correctValue ?? ''}
            onChange={(e) => setGrid(q.id, e.target.value)}
            disabled={done}
            placeholder="masalan 6 yoki 1/2, 0.5"
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-line text-[13px] font-semibold focus:outline-none focus:border-green disabled:bg-transparent"
          />
        ) : (
          <div className="flex gap-1.5">
            {(['A', 'B', 'C', 'D'] as ChoiceId[]).map((id) => (
              <button
                key={id}
                type="button"
                disabled={done}
                onClick={() => setChoice(q.id, id)}
                className={`w-8 h-8 rounded-md text-[13px] font-bold border-2 transition-colors ${
                  a?.correct === id
                    ? 'border-green bg-green-mist text-green-deep'
                    : 'border-line text-ink-soft hover:border-green'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12.5px] font-bold text-ink-soft">
          Javob belgilangan: {answeredCount}/{allQuestions.length}
        </div>
        {unanswered > 0 && (
          <div className="text-[11.5px] font-semibold text-amber-600">
            {unanswered} ta savolda javob yo&apos;q{done ? " — o'quvchilar bu savollarni noto'g'ri deb hisoblanadi!" : ''}
          </div>
        )}
      </div>

      {/* Sections — all visible, scroll down for the next module. Dimmed (and
          locked) once the sheet is saved/complete. */}
      <div
        className={`flex flex-col gap-6 transition-[opacity,filter] duration-500 ${
          done ? 'opacity-45 saturate-50' : 'opacity-100'
        }`}
        aria-disabled={done}
      >
        {sections.map((section) => {
          const half = Math.ceil(section.questions.length / 2)
          const left = section.questions.slice(0, half)
          const right = section.questions.slice(half)
          return (
            <section key={section.key}>
              {section.label && (
                <div className="flex items-center gap-2 mb-2.5">
                  <h3 className="text-[13px] font-extrabold text-ink">{section.label}</h3>
                  <span className="text-[11.5px] font-semibold text-ink-faint">
                    {section.questions.filter((q) => isAnswered(q, answers[q.id])).length}/{section.questions.length}
                  </span>
                  <div className="flex-1 h-px bg-line" />
                </div>
              )}
              {/* Numbers run vertically: left column 1…half, right column half+1…n */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                <div className="flex flex-col gap-2">{left.map((q, i) => renderRow(q, i + 1))}</div>
                <div className="flex flex-col gap-2">{right.map((q, i) => renderRow(q, half + i + 1))}</div>
              </div>
            </section>
          )
        })}
      </div>

      {error && (
        <div className="flex items-start gap-1.5 text-[12px] text-red-600 mt-3">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Sticky action bar */}
      <div className={`sticky ${raised ? 'bottom-24' : 'bottom-3'} z-10 mt-5`}>
        {done ? (
          <div className="flex items-center gap-3 rounded-[12px] border border-green bg-green-mist px-4 py-3 shadow-lg">
            <span className="flex size-8 items-center justify-center rounded-full bg-green text-white shrink-0">
              <CheckCircle2 size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-extrabold text-green-deep">
                {changedCount === 0 ? "O'zgarish yo'q — hech narsa qayta yozilmadi" : `Saqlandi — ${changedCount} ta javob o'zgartirildi`}
              </div>
              <div className="text-[11.5px] text-ink-soft">
                Faqat javob kalitlari saqlanadi — savol matni, rasmlar va Check it now&apos;dagi joylashuvga tegilmaydi · {allQuestions.length} ta savol
                {rescored > 0 ? ` · ${rescored} ta oldin topshirilgan natija qayta hisoblandi` : ''}
                {notified > 0 ? ` · ${notified} ta o‘quvchiga qo‘ng‘iroqcha xabari yuborildi` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDone(false)}
              className="flex items-center gap-1.5 rounded-lg border border-green bg-white px-3 py-2 text-[12.5px] font-bold text-green-deep hover:bg-green-mist"
            >
              <Pencil size={14} /> Tahrirlash
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-[12px] bg-white/90 p-1 backdrop-blur">
            <div
              className={`px-1 text-[12px] font-bold ${pending > 0 ? 'text-amber-600' : 'text-ink-faint'}`}
              aria-live="polite"
            >
              {pending > 0 ? `${pending} ta javob o'zgardi — hali saqlanmagan` : "Hozircha o'zgarish yo'q"}
            </div>
            <div className="flex items-center gap-2">
            {savedSnapshot && (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-[10px] border border-line px-3.5 py-2.5 text-[13px] font-bold text-ink-soft hover:border-green disabled:opacity-40"
              >
                <Undo2 size={14} /> Bekor qilish
              </button>
            )}
            <button
              type="button"
              onClick={submitAll}
              disabled={saving || (!!savedSnapshot && !dirty)}
              className="flex-1 py-2.5 rounded-[10px] font-bold text-[13px] text-white flex items-center justify-center gap-2 disabled:opacity-40 bg-[linear-gradient(135deg,var(--green-deep),var(--green)_65%,var(--green-bright))]"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              {saving
                ? 'Saqlanmoqda...'
                : savedSnapshot
                  ? 'Qayta saqlash'
                  : pending > 0
                    ? `Barchasini saqlash va tugatish (${pending} ta javob)`
                    : 'Barchasini saqlash va tugatish'}
            </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom toast */}
      <div
        className={`pointer-events-none fixed ${raised ? 'bottom-28' : 'bottom-6'} left-1/2 z-50 -translate-x-1/2 transition-all duration-500 ease-out ${
          toastVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2.5 rounded-full bg-ink px-5 py-3 text-white shadow-2xl">
          <span
            className={`flex size-6 items-center justify-center rounded-full bg-green transition-transform duration-500 ${
              toastVisible ? 'scale-100' : 'scale-50'
            }`}
          >
            <CheckCircle2 size={16} />
          </span>
          <span className="text-[13px] font-bold">{changedCount === 0 ? "O'zgarish yo'q" : `Saqlandi — ${changedCount ?? 0} ta javob`}</span>
        </div>
      </div>
    </div>
  )
}

/** Single-module convenience wrapper (used by the "Testni tahrirlash" tab). */
export function AnswerEntry({
  questions,
  onSaved,
}: {
  questions: QuestionWithId[]
  onSaved?: (updated: QuestionWithId) => void
}) {
  return <AnswerSheet sections={[{ key: 'single', questions }]} onSaved={onSaved} />
}
