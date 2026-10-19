'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Pencil, Search, Trash2, X } from 'lucide-react'
import { QuestionStimulus } from '@/components/question-stimulus'
import { ChoiceContent } from '@/components/choice-content'
import { RichText } from '@/components/rich-text'
import type { Choice, Question } from '@/lib/test-data'
import type { BankRow } from '@/app/api/admin/question-bank/items/route'

type Facets = { topics: Record<string, { code: string; topic: string; count: number }[]>; needsCheck: number; bankTotal: number }
const DOMAINS = ['Algebra', 'Advanced Math', 'Problem-Solving and Data Analysis', 'Geometry and Trigonometry']

const asQuestion = (r: BankRow): Question => ({
  id: r.id,
  type: r.type,
  difficulty: r.difficulty.toLowerCase() as Question['difficulty'],
  prompt: r.prompt,
  equations: r.equations ?? undefined,
  image: r.image ?? undefined,
  domain: r.domain,
})

/** The question as students see it: stimulus, rounded A–D cards with the right one in green. */
function BankPreview({ row }: { row: BankRow }) {
  const q = asQuestion(row)
  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-3">
        <QuestionStimulus question={q} withFigure textClassName="text-[15.5px] leading-[1.6] text-[#111]" plain />
      </div>
      {row.type === 'gridin' ? (
        <div className="mt-2 text-[13px] text-ink-soft">
          Yozma javob: <b className="rounded-md bg-green-mist px-2 py-0.5 text-green-deep">{row.correct_value ?? '—'}</b>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {(row.choices ?? []).map((c) => {
            const right = row.correct === c.id
            return (
              <div
                key={c.id}
                className={`flex min-h-[44px] items-center gap-3.5 rounded-lg border-[1.5px] px-3.5 py-2 ${right ? 'border-[#16a34a] bg-green-50' : 'border-[#777] bg-white'}`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-sm font-bold ${right ? 'border-[#16a34a] bg-[#16a34a] text-white' : 'border-[#777] text-[#111]'}`}
                >
                  {c.id}
                </span>
                <span className="text-[15px] text-[#111]">
                  <ChoiceContent choice={c as Choice} plain />
                </span>
              </div>
            )
          })}
        </div>
      )}
      {row.explanation && (
        <div className="mt-3 text-[13px] leading-relaxed text-[#111]">
          <div className="font-bold text-ink">Yechim</div>
          <RichText text={row.explanation} />
        </div>
      )}
    </div>
  )
}

const inp = 'w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-green'

function Editor({ row, onSaved, onCancel }: { row: BankRow; onSaved: (r: BankRow) => void; onCancel: () => void }) {
  const [d, setD] = useState({
    prompt: row.prompt,
    equations: (row.equations ?? []).join('\n'),
    choices: (row.choices ?? []).map((c) => ({ ...c })),
    correct: row.correct ?? 'A',
    correct_value: row.correct_value ?? '',
    difficulty: row.difficulty,
    explanation: row.explanation ?? '',
    note: row.note ?? '',
    needs_check: row.needs_check,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Live preview of what is being typed.
  const live: BankRow = useMemo(
    () => ({
      ...row,
      prompt: d.prompt,
      equations: d.equations.split('\n').map((x) => x.trim()).filter(Boolean),
      choices: row.type === 'mcq' ? d.choices : null,
      correct: row.type === 'mcq' ? d.correct : null,
      correct_value: row.type === 'gridin' ? d.correct_value : null,
      explanation: d.explanation || null,
    }),
    [row, d],
  )

  async function save(confirmChecked: boolean) {
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch(`/api/admin/question-bank/items/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: d.prompt,
          equations: d.equations.split('\n'),
          ...(row.type === 'mcq' ? { choices: d.choices, correct: d.correct } : { correct_value: d.correct_value }),
          difficulty: d.difficulty,
          explanation: d.explanation,
          note: d.note,
          needs_check: confirmChecked ? false : d.needs_check,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Xatolik')
      onSaved(j.row)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xatolik')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      <div className="space-y-2.5">
        <label className="block text-[11.5px] font-bold text-ink-faint">
          Savol matni (formulalar $...$ ichida)
          <textarea className={`${inp} mt-1 min-h-[110px] font-mono`} value={d.prompt} onChange={(e) => setD({ ...d, prompt: e.target.value })} />
        </label>
        <label className="block text-[11.5px] font-bold text-ink-faint">
          Alohida tenglamalar (har qatorda bittadan, LaTeX)
          <textarea className={`${inp} mt-1 min-h-[54px] font-mono`} value={d.equations} onChange={(e) => setD({ ...d, equations: e.target.value })} />
        </label>
        {row.type === 'mcq' ? (
          <div className="space-y-1.5">
            <div className="text-[11.5px] font-bold text-ink-faint">Variantlar (to‘g‘risini belgilang)</div>
            {d.choices.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <input type="radio" name={`c-${row.id}`} checked={d.correct === c.id} onChange={() => setD({ ...d, correct: c.id })} aria-label={`${c.id} to‘g‘ri`} />
                <span className="w-4 text-[13px] font-bold">{c.id}</span>
                <input
                  className={`${inp} font-mono`}
                  placeholder={c.image ? '(rasmli variant)' : 'Matn yoki LaTeX'}
                  value={c.tex ?? c.text ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    const next = d.choices.map((x, j) => (j === i ? (x.tex !== undefined ? { ...x, tex: v } : { ...x, text: v }) : x))
                    setD({ ...d, choices: next })
                  }}
                />
              </div>
            ))}
            <p className="text-[11px] text-ink-faint">Variantda formula bo‘lsa u LaTeX bo‘lib saqlangan (tex), oddiy matn bo‘lsa text.</p>
          </div>
        ) : (
          <label className="block text-[11.5px] font-bold text-ink-faint">
            To‘g‘ri javob (bir nechta shakl bo‘lsa vergul bilan: 1/5, .2)
            <input className={`${inp} mt-1`} value={d.correct_value} onChange={(e) => setD({ ...d, correct_value: e.target.value })} />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[11.5px] font-bold text-ink-faint">
            Qiyinlik
            <select className={`${inp} mt-1`} value={d.difficulty} onChange={(e) => setD({ ...d, difficulty: e.target.value as BankRow['difficulty'] })}>
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </label>
          <label className="block text-[11.5px] font-bold text-ink-faint">
            Izoh (ichki)
            <input className={`${inp} mt-1`} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
          </label>
        </div>
        <label className="block text-[11.5px] font-bold text-ink-faint">
          Yechim (explanation)
          <textarea className={`${inp} mt-1 min-h-[70px] font-mono`} value={d.explanation} onChange={(e) => setD({ ...d, explanation: e.target.value })} />
        </label>
        {err && <p className="text-[12.5px] text-red-600">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => save(false)} className="inline-flex items-center gap-1.5 rounded-lg bg-green px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-50">
            {busy && <Loader2 size={13} className="animate-spin" />} Saqlash
          </button>
          {row.needs_check && (
            <button disabled={busy} onClick={() => save(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-green px-3.5 py-2 text-[13px] font-bold text-green-deep disabled:opacity-50">
              <CheckCircle2 size={14} /> Saqlash va «tekshirildi» deb belgilash
            </button>
          )}
          <button onClick={onCancel} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-soft hover:bg-bg-deep">
            Bekor qilish
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-white p-4">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-ink-faint">Saytdagi ko‘rinishi</div>
        <BankPreview row={live} />
      </div>
    </div>
  )
}

/** Admin: browse the book bank by section / topic / difficulty, find the «tekshirish kerak» ones, fix and approve them. */
export function BookBankBrowser() {
  const [f, setF] = useState({ domain: '', topic: '', difficulty: '', needsCheck: false, q: '' })
  const [qDraft, setQDraft] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<BankRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [size, setSize] = useState(20)
  const [facets, setFacets] = useState<Facets | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setRows(null)
    const sp = new URLSearchParams()
    if (f.domain) sp.set('domain', f.domain)
    if (f.topic) sp.set('topic', f.topic)
    if (f.difficulty) sp.set('difficulty', f.difficulty)
    if (f.needsCheck) sp.set('needsCheck', '1')
    if (f.q) sp.set('q', f.q)
    sp.set('page', String(page))
    try {
      const r = await fetch(`/api/admin/question-bank/items?${sp}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Xatolik')
      setRows(d.rows)
      setTotal(d.total)
      setSize(d.pageSize)
      setFacets({ topics: d.topics, needsCheck: d.needsCheck, bankTotal: d.bankTotal })
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xatolik')
      setRows([])
    }
  }, [f, page])
  useEffect(() => {
    load()
  }, [load])

  const set = (patch: Partial<typeof f>) => {
    setPage(0)
    setF((x) => ({ ...x, ...patch }))
  }
  const topics = f.domain ? (facets?.topics[f.domain] ?? []) : []
  const pages = Math.max(1, Math.ceil(total / size))

  async function remove(r: BankRow) {
    if (!confirm('Bu savol bankdan o‘chiriladi. Davom etasizmi?')) return
    await fetch(`/api/admin/question-bank/items/${r.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Pencil size={16} className="text-green" />
        <h3 className="text-[15px] font-extrabold text-ink">Banknu ko‘rish va tahrirlash</h3>
      </div>
      <p className="mb-3 text-[12.5px] text-ink-soft">
        Bo‘lim va mavzu bo‘yicha toping, savolni saytdagidek ko‘ring va tuzating. Tahrir qilingan savol qayta import qilinganda ustiga yozilmaydi.
      </p>

      {facets && facets.needsCheck > 0 && (
        <button
          type="button"
          onClick={() => set({ needsCheck: !f.needsCheck })}
          className={`mb-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-bold ${
            f.needsCheck ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-amber-300 bg-amber-50 text-amber-800'
          }`}
        >
          <AlertTriangle size={14} /> Tekshirish kerak: {facets.needsCheck} ta {f.needsCheck && '(filtr yoqilgan)'}
        </button>
      )}

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <select className={`${inp} !w-auto`} value={f.domain} onChange={(e) => set({ domain: e.target.value, topic: '' })}>
          <option value="">Barcha bo‘limlar</option>
          {DOMAINS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select className={`${inp} !w-auto`} value={f.topic} disabled={!f.domain} onChange={(e) => set({ topic: e.target.value })}>
          <option value="">{f.domain ? 'Barcha mavzular' : 'Avval bo‘limni tanlang'}</option>
          {topics.map((t) => (
            <option key={t.code} value={t.code}>
              {t.topic} ({t.count})
            </option>
          ))}
        </select>
        <select className={`${inp} !w-auto`} value={f.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
          <option value="">Qiyinlik: hammasi</option>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            set({ q: qDraft.trim() })
          }}
        >
          <input className={`${inp} !w-52`} placeholder="Matn yoki ID bo‘yicha qidirish" value={qDraft} onChange={(e) => setQDraft(e.target.value)} />
          <button className="rounded-lg border border-line p-2 text-ink-soft hover:bg-bg-deep" aria-label="Qidirish">
            <Search size={14} />
          </button>
          {f.q && (
            <button type="button" onClick={() => { setQDraft(''); set({ q: '' }) }} className="rounded-lg p-2 text-ink-soft hover:bg-bg-deep" aria-label="Tozalash">
              <X size={14} />
            </button>
          )}
        </form>
        <span className="ml-auto text-[12px] text-ink-faint">{rows ? `${total} ta savol` : ''}</span>
      </div>

      {err && <p className="mb-2 text-[12.5px] text-red-600">{err} — jadval yaratilmagan bo‘lishi mumkin (supabase/question_bank.sql).</p>}
      {!rows && (
        <div className="flex items-center gap-2 py-4 text-[13px] text-ink-faint">
          <Loader2 size={15} className="animate-spin" /> Yuklanmoqda...
        </div>
      )}

      <div className="space-y-2">
        {rows?.map((r) => {
          const isOpen = open === r.id || editing === r.id
          return (
            <div key={r.id} className={`rounded-xl border p-3 ${r.needs_check ? 'border-amber-300 bg-amber-50/50' : 'border-line bg-white'}`}>
              <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-bold">
                <span className="rounded-full bg-bg-deep px-2 py-0.5 text-ink-soft">{r.topic_code} · {r.topic}</span>
                <span className="uppercase text-ink-faint">{r.difficulty}</span>
                <span className="text-ink-faint">{r.type === 'gridin' ? 'Yozma javob' : 'Test'}</span>
                <span className="text-ink-faint">#{r.number}</span>
                {r.needs_check && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-amber-900">
                    <AlertTriangle size={11} /> tekshirish kerak
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  <button onClick={() => setOpen(open === r.id ? null : r.id)} className="rounded-lg px-2 py-1 text-green-deep hover:bg-green-mist">
                    {isOpen ? 'Yopish' : 'Ko‘rish'}
                  </button>
                  <button onClick={() => { setEditing(editing === r.id ? null : r.id); setOpen(null) }} className="rounded-lg px-2 py-1 text-ink hover:bg-bg-deep">
                    Tahrirlash
                  </button>
                  <button onClick={() => remove(r)} aria-label="O‘chirish" className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
              {r.note && <p className="mt-1 text-[12px] text-amber-800">Izoh: {r.note}</p>}
              {!isOpen && (
                <div className="mt-1.5 line-clamp-2 text-[13px] text-ink-soft">
                  <RichText text={r.prompt} />
                </div>
              )}
              {editing === r.id ? (
                <Editor
                  row={r}
                  onCancel={() => setEditing(null)}
                  onSaved={(nr) => {
                    setRows((l) => (l ? l.map((x) => (x.id === nr.id ? nr : x)) : l))
                    setEditing(null)
                    load()
                  }}
                />
              ) : (
                open === r.id && (
                  <div className="mt-3 rounded-xl border border-line bg-white p-4">
                    <BankPreview row={r} />
                  </div>
                )
              )}
            </div>
          )
        })}
        {rows && rows.length === 0 && !err && <p className="py-4 text-[13px] text-ink-faint">Bu filtr bo‘yicha savol topilmadi.</p>}
      </div>

      {rows && total > size && (
        <div className="mt-3 flex items-center justify-center gap-3 text-[13px]">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-line p-1.5 disabled:opacity-40" aria-label="Oldingi">
            <ChevronLeft size={15} />
          </button>
          <span className="text-ink-soft">
            {page + 1} / {pages}
          </span>
          <button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-line p-1.5 disabled:opacity-40" aria-label="Keyingi">
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
