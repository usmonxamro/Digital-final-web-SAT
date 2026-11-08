'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Check, ChevronDown, Copy, Eye, Loader2, Pencil, Save, Send, Trash2, X } from 'lucide-react'
import { ChoiceContent } from '@/components/choice-content'
import { QuestionImage } from '@/components/question-image'
import { QuestionStimulus } from '@/components/question-stimulus'
import { RichText } from '@/components/rich-text'
import type { ChoiceId, Question } from '@/lib/test-data'
import type { ReportRow } from '@/app/api/admin/reports/route'


/**
 * The reported question drawn the way a student saw it: rendered math, figure, passage and the A/B/C/D option cards
 * (the key is marked green) — so the admin can judge "is something placed wrongly?" without reading raw LaTeX.
 */
function QuestionPreview({
  questionId,
  fallbackPrompt,
  defaultOpen,
  onFixed,
}: {
  questionId: string | null
  fallbackPrompt: string
  defaultOpen: boolean
  /** Called after a successful in-place fix, with a ready reply text for the student. */
  onFixed?: (replyDraft: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [q, setQ] = useState<(Question & { kind?: 'reading' | 'math' }) | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    if (!open || q || !questionId) return
    let alive = true
    setState('loading')
    fetch(`/api/admin/questions/${encodeURIComponent(questionId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d?.question) {
          setQ(d.question)
          setState('idle')
        } else setState('error')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [open, q, questionId])

  const reading = q ? q.kind === 'reading' || (!q.kind && !!q.passage) : false
  const textCls = reading ? 'q-ink text-[15.5px] font-semibold leading-[1.5] text-ink' : 'q-ink text-[15.5px] leading-[1.6] text-ink'

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[12px] font-extrabold text-green-deep hover:underline"
      >
        <Eye size={14} /> {open ? 'Savolni yashirish' : 'Savolni sayt ko‘rinishida ko‘rish'}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-line bg-white p-4">
          {state === 'loading' && (
            <div className="flex items-center gap-2 text-[12.5px] text-ink-faint">
              <Loader2 size={14} className="animate-spin" /> Savol yuklanmoqda…
            </div>
          )}

          {!q && state !== 'loading' && (
            <div>
              {state === 'error' && <p className="mb-2 text-[11.5px] font-semibold text-amber-700">Savolni bazadan olib bo‘lmadi (o‘chirilgan yoki ID yo‘q) — xabardagi matn:</p>}
              <div className="q-ink text-[15px] leading-relaxed text-ink">
                <RichText text={fallbackPrompt} />
              </div>
            </div>
          )}

          {q && (
            <div className={`mx-auto ${reading ? 'max-w-[1100px]' : 'max-w-[760px]'}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-ink-faint">
                {q.domain && <span>{q.domain}</span>}
                {q.difficulty && <span className="uppercase">{q.difficulty}</span>}
                <span className="rounded-full bg-green-mist px-2 py-px text-green-deep">
                  To‘g‘ri javob: {q.type === 'gridin' ? (q.correctValue ?? '—') : (q.correct ?? 'belgilanmagan')}
                </span>
              </div>

              {/* Reading & Writing: passage on the left, question + options on the right (as in Bluebook) */}
              <div className={reading ? 'grid gap-5 md:grid-cols-2 md:gap-0' : ''}>
                {reading && (q.passage || q.image) && (
                  <div className="min-w-0 md:border-r md:border-line md:pr-6">
                    {q.passage && <div className="whitespace-pre-line font-serif text-[15.5px] leading-[1.65] text-ink">{q.passage}</div>}
                    {q.image && <QuestionImage src={q.image} scale={q.layout?.img?.scale} plain />}
                  </div>
                )}

                <div className={reading ? 'min-w-0 md:pl-6' : ''}>
                  <div className="mb-3">
                    <QuestionStimulus question={q} withFigure={!reading} textClassName={textCls} plain />
                  </div>

                  {q.type === 'gridin' ? (
                    <div className="mt-2 h-12 w-44 rounded-lg border-[1.5px] border-line" />
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {(q.choices ?? []).map((c) => {
                        const right = q.correct === c.id
                        return (
                          <div
                            key={c.id}
                            className={`flex min-h-[44px] items-center gap-3.5 rounded-xl px-3.5 py-2 ${reading ? 'font-serif' : 'font-sans'} ${
                              right
                                ? 'border-2 border-[#16a34a] bg-[#16a34a]/10 shadow-[0_0_0_3px_rgba(22,163,74,.14)]'
                                : 'border-[1.5px] border-ink-faint/60'
                            }`}
                          >
                            <span
                              className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] font-sans text-sm font-bold ${
                                right ? 'border-[#16a34a] bg-[#16a34a] text-white' : 'border-ink-faint text-ink'
                              }`}
                            >
                              {c.id}
                            </span>
                            <span className="q-ink text-[15px] text-ink">
                              <ChoiceContent choice={c} scale={q.layout?.choiceImg?.[c.id]?.scale} plain />
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              {questionId && (
                <QuickFix
                  questionId={questionId}
                  q={q}
                  onSaved={(next, info) => {
                    setQ(next)
                    onFixed?.(info)
                  }}
                />
              )}
              {q.explanation && (
                <details className="mt-3 text-[12.5px] text-ink-soft">
                  <summary className="cursor-pointer font-bold text-ink">Yechim (explanation)</summary>
                  <div className="q-ink mt-1.5 text-[13px] leading-relaxed text-ink">
                    <RichText text={q.explanation} />
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type FullQuestion = Question & { kind?: 'reading' | 'math'; testLabel?: string; moduleNumber?: 1 | 2 }

/**
 * "Shu joyning o'zida tuzatish": change the answer key (one click on A/B/C/D or a new grid-in value) and,
 * if needed, the question text / options / explanation — saved straight to the database. Students who already
 * took the mock are re-scored automatically by PATCH /api/admin/questions/[id].
 */
function QuickFix({ questionId, q, onSaved }: { questionId: string; q: FullQuestion; onSaved: (q: FullQuestion, replyDraft: string) => void }) {
  const [correct, setCorrect] = useState<ChoiceId | undefined>(q.correct)
  const [value, setValue] = useState(q.correctValue ?? '')
  const [editText, setEditText] = useState(false)
  const [prompt, setPrompt] = useState(q.prompt)
  const [passage, setPassage] = useState(q.passage ?? '')
  const [choices, setChoices] = useState(q.choices ?? [])
  const [explanation, setExplanation] = useState(q.explanation ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const gridin = q.type === 'gridin'
  const keyChanged = gridin ? value.trim() !== (q.correctValue ?? '') : correct !== q.correct
  const textChanged =
    editText &&
    (prompt !== q.prompt ||
      passage !== (q.passage ?? '') ||
      explanation !== (q.explanation ?? '') ||
      JSON.stringify(choices) !== JSON.stringify(q.choices ?? []))
  const dirty = keyChanged || textChanged

  async function save() {
    if (!dirty || busy) return
    setBusy(true)
    setMsg(null)
    const { kind: _k, testLabel: _t, moduleNumber: _m, id: _i, ...rest } = q
    void _k
    void _t
    void _m
    void _i
    const next: Question = {
      ...rest,
      prompt: editText ? prompt : q.prompt,
      passage: editText ? passage || undefined : q.passage,
      choices: gridin ? undefined : editText ? choices : q.choices,
      explanation: editText ? explanation || undefined : q.explanation,
      ...(gridin ? { correctValue: value.trim() || undefined } : { correct }),
    }
    const res = await fetch(`/api/admin/questions/${encodeURIComponent(questionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: next }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (!res || !res.ok) {
      setMsg({ ok: false, text: d?.error ?? 'Saqlab bo‘lmadi — internetni tekshiring.' })
      return
    }
    const rescored = Number(d?.rescored ?? 0)
    setMsg({
      ok: true,
      text: `Bazaga saqlandi.${keyChanged ? ` Natijasi qayta hisoblangan urinishlar: ${rescored} ta.` : ''}`,
    })
    const newKey = gridin ? value.trim() : correct
    const replyDraft = keyChanged
      ? `Rahmat! Siz haq edingiz — to‘g‘ri javob ${newKey} ekan, kalit tuzatildi.${rescored ? ' Natijangiz qayta hisoblandi.' : ''}`
      : 'Rahmat! Savoldagi xatolik tuzatildi.'
    onSaved({ ...q, ...next, id: q.id, kind: q.kind, testLabel: q.testLabel, moduleNumber: q.moduleNumber }, replyDraft)
    setEditText(false)
  }

  const field = 'w-full rounded-lg border border-line px-2.5 py-1.5 font-mono text-[12.5px] outline-none focus:border-green'
  return (
    <div className="mt-4 rounded-xl border border-dashed border-green/70 bg-green-mist/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-extrabold text-ink">Javob kalitini tuzatish:</span>
        {gridin ? (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="masalan 6 yoki 2/3"
            className="w-40 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] font-bold outline-none focus:border-green"
          />
        ) : (
          (q.choices ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCorrect(c.id)}
              className={`size-8 rounded-full border-[1.5px] text-[13px] font-extrabold transition ${
                correct === c.id ? 'border-[#16a34a] bg-[#16a34a] text-white' : 'border-ink-faint bg-white text-ink hover:border-[#16a34a]'
              }`}
            >
              {c.id}
            </button>
          ))
        )}
        <button
          type="button"
          onClick={() => setEditText((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] font-bold text-ink-soft hover:border-green"
        >
          {editText ? <X size={13} /> : <Pencil size={13} />} {editText ? 'Matn tahririni yopish' : 'Matnni tahrirlash'}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green px-3 py-1.5 text-[12.5px] font-extrabold text-white hover:brightness-110 disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Bazaga saqlash
        </button>
      </div>

      {editText && (
        <div className="mt-3 flex flex-col gap-2.5">
          {q.passage !== undefined && (
            <label className="text-[11.5px] font-bold text-ink-soft">
              Passage
              <textarea value={passage} onChange={(e) => setPassage(e.target.value)} rows={5} className={field} />
            </label>
          )}
          <label className="text-[11.5px] font-bold text-ink-soft">
            Savol matni (prompt) — formulalar $...$ ichida
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className={field} />
          </label>
          {!gridin &&
            choices.map((c, i) => {
              const key = c.tex !== undefined && c.text === undefined ? 'tex' : 'text'
              return (
                <label key={c.id} className="text-[11.5px] font-bold text-ink-soft">
                  {c.id} variant ({key === 'tex' ? 'LaTeX' : 'matn'})
                  <input
                    value={(key === 'tex' ? c.tex : c.text) ?? ''}
                    onChange={(e) =>
                      setChoices((arr) => arr.map((x, j) => (j === i ? { ...x, [key]: e.target.value } : x)))
                    }
                    className={field}
                  />
                </label>
              )
            })}
          <label className="text-[11.5px] font-bold text-ink-soft">
            Yechim (explanation)
            <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} className={field} />
          </label>
        </div>
      )}
      {msg && <p className={`mt-2 text-[12px] font-semibold ${msg.ok ? 'text-green-deep' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  )
}

/** Admin "Xato xabarlari": questions students flagged after a mock; the reply lands in their bell. */
export function ReportsPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [needSql, setNeedSql] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<Record<string, string>>({})

  async function load() {
    const d = await fetch('/api/admin/reports').then((r) => r.json()).catch(() => null)
    setRows(d?.items ?? [])
    setNeedSql(!!d?.migrationNeeded)
    onChanged?.()
  }
  useEffect(() => {
    load()
  }, [])

  async function reply(id: string) {
    const text = (drafts[id] ?? '').trim()
    if (!text || busy) return
    setBusy(id)
    setErr((e) => ({ ...e, [id]: '' }))
    const res = await fetch('/api/admin/reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reply: text }) })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) return setErr((e) => ({ ...e, [id]: d.error ?? 'Xato' }))
    setDrafts((x) => ({ ...x, [id]: '' }))
    load()
  }

  async function resolve(id: string) {
    await fetch('/api/admin/reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, resolve: true }) })
    load()
  }

  if (!rows) {
    return (
      <div className="flex items-center gap-2 py-6 text-[13px] text-ink-faint">
        <Loader2 size={15} className="animate-spin" /> Yuklanmoqda...
      </div>
    )
  }
  const open = rows.filter((r) => r.status === 'open').length
  return (
    <div>
      {needSql && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Jadval yo&apos;q — supabase/schema.sql oxiridagi v71 qismini ishga tushiring.
        </div>
      )}
      {rows.length === 0 && !needSql && <p className="text-[13px] text-ink-faint">Hozircha xato xabarlari yo&apos;q.</p>}
      {rows.length > 0 && <p className="mb-3 text-[12.5px] font-semibold text-ink-soft">Javob kutayotgan: {open} ta</p>}
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.id} className={`rounded-xl border bg-white p-4 ${r.status === 'open' ? 'border-green' : 'border-line'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-extrabold text-ink">
                {r.status === 'open' && <span className="mr-1.5 rounded-full bg-red-500 px-1.5 py-px text-[9.5px] font-extrabold text-white">YANGI</span>}
                {r.name || 'Noma’lum'} <span className="ml-1 font-semibold text-ink-soft">· {r.test_label}{r.q_number ? ` · ${r.q_number}-savol` : ''}</span>
                {r.module_label && <span className="ml-1 text-[11.5px] font-semibold text-ink-faint">({r.module_label})</span>}
              </div>
              <div className="flex items-center gap-2 text-[11.5px] text-ink-faint">
                {r.status === 'answered' && <CheckCircle2 size={14} className="text-green" />}
                {new Date(r.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
                <button
                  onClick={async () => {
                    if (!confirm('O‘chirilsinmi?')) return
                    await fetch('/api/admin/reports', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) })
                    load()
                  }}
                  title="O‘chirish"
                  className="hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <QuestionPreview
              questionId={r.question_id}
              fallbackPrompt={r.prompt}
              defaultOpen={r.status === 'open'}
              onFixed={(draft) => setDrafts((x) => ({ ...x, [r.id]: x[r.id]?.trim() ? x[r.id] : draft }))}
            />
            {r.question_id && (
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(r.question_id!).catch(() => {})}
                title="Savol ID sini nusxalash — Testni tahrirlash → ID bo'yicha qidirish"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-ink-faint hover:text-ink"
              >
                <Copy size={11} /> Savol ID: <span className="font-mono">{r.question_id}</span>
              </button>
            )}
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink">{r.message}</p>
            {r.reply && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-green-mist px-3 py-2 text-[12.5px] text-green-deep">
                <b>Javobingiz:</b> {r.reply}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={drafts[r.id] ?? ''}
                onChange={(e) => setDrafts((x) => ({ ...x, [r.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && reply(r.id)}
                placeholder={r.reply ? 'Yangi javob yozish...' : 'Javob yozing — o‘quvchining qo‘ng‘iroqchasiga boradi'}
                className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-green"
              />
              <button
                onClick={() => reply(r.id)}
                disabled={busy === r.id || !(drafts[r.id] ?? '').trim()}
                className="flex items-center gap-1.5 rounded-lg bg-green px-3 py-2 text-[12.5px] font-extrabold text-white hover:brightness-110 disabled:opacity-50"
              >
                {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Yuborish
              </button>
              {r.status === 'open' && (
                <button
                  onClick={() => resolve(r.id)}
                  title="Javob yozmasdan, hal qilindi deb belgilash"
                  className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] font-bold text-ink-soft hover:border-green"
                >
                  <Check size={14} /> Hal qilindi
                </button>
              )}
            </div>
            {err[r.id] && <p className="mt-1.5 text-[12px] font-semibold text-red-600">{err[r.id]}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
