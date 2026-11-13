'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, ChevronDown, EyeOff, Loader2, Pencil, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import type { AuditResult, AuditRow } from '@/lib/key-audit'
import type { Question } from '@/lib/test-data'
import { QuestionCard } from '@/components/admin/question-card'

const SEEN_KEY = 'admin-key-audit-seen'
const LEVELS: { level: 0 | 1 | 2 | 3; label: string; cls: string; dot: string }[] = [
  { level: 0, label: 'Hammasi', cls: '', dot: '' },
  { level: 3, label: 'Deyarli aniq xato', cls: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500' },
  { level: 2, label: 'Ehtimol xato', cls: 'text-amber-800 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  { level: 1, label: "Ko'rib chiqing", cls: 'text-slate-700 bg-slate-50 border-slate-200', dot: 'bg-slate-400' },
]
const levelOf = (l: number) => LEVELS.find((x) => x.level === l) ?? LEVELS[3]

/** A row is "seen" for the key it had then — if the key changes later, it shows up again. */
const seenToken = (r: AuditRow) => `${r.id}|${r.botKey ?? ''}|${r.siteKey ?? ''}`

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/**
 * "Xato ehtimoli bor savollar": every question whose answer key looks wrong, why, what the students answered,
 * the question itself (when it is on the site) and a one-click key fix.
 */
export function KeyAudit({ onEdit, onCount }: { onEdit?: (label: string) => void; onCount?: (n: number) => void }) {
  const [data, setData] = useState<AuditResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0)
  const [q, setQ] = useState('')
  const [where, setWhere] = useState<'all' | 'site' | 'bot'>('all')
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [showSeen, setShowSeen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/bot-sync?audit=1', { cache: 'no-store' })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? "Yuklab bo'lmadi.")
      else setData(d)
    } catch {
      setError("Server bilan bog'lanib bo'lmadi.")
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    setSeen(loadSeen())
    load()
  }, [load])

  const markSeen = (r: AuditRow, on: boolean) =>
    setSeen((cur) => {
      const n = new Set(cur)
      if (on) n.add(seenToken(r))
      else n.delete(seenToken(r))
      try {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify([...n].slice(-3000)))
      } catch {
        /* ignore */
      }
      return n
    })

  const open = useMemo(() => (data?.rows ?? []).filter((r) => !seen.has(seenToken(r))), [data, seen])
  useEffect(() => {
    if (data) onCount?.(open.filter((r) => r.level >= 2).length)
  }, [data, open, onCount])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, '')
    return (data?.rows ?? []).filter((r) => {
      if (!showSeen && seen.has(seenToken(r))) return false
      if (level && r.level !== level) return false
      if (where === 'site' && !r.questionId) return false
      if (where === 'bot' && r.questionId) return false
      if (needle && !(r.mockName.toLowerCase().includes(needle) || (r.testLabel ?? '').toLowerCase().includes(needle) || r.botCode === needle)) return false
      return true
    })
  }, [data, q, level, where, seen, showSeen])

  const groups = useMemo(() => {
    const m = new Map<string, AuditRow[]>()
    for (const r of shown) {
      const k = r.testLabel ?? `bot:${r.botCode}`
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.entries()]
      .map(([key, rows]) => ({ key, rows: rows.sort((a, b) => (a.qNo ?? 0) - (b.qNo ?? 0)), top: Math.max(...rows.map((r) => r.level)), score: Math.max(...rows.map((r) => r.score)) }))
      .sort((a, b) => b.top - a.top || b.rows.length - a.rows.length || b.score - a.score)
  }, [shown])

  const countAt = (l: number) => open.filter((r) => (l ? r.level === l : true)).length

  return (
    <div>
      <div className="mb-3 rounded-xl border border-line bg-bg-deep/40 p-3 text-[12.5px] leading-relaxed text-ink-soft">
        <b className="text-ink">Bu yerda nima ko&apos;rinadi:</b> bot va saytdagi barcha javoblar bo&apos;yicha kaliti xato bo&apos;lishi mumkin bo&apos;lgan savollar va <b>sababi</b>. Belgilar: bot va sayt
        kaliti har xil · kalit turi mos emas (harf/son) · to&apos;g&apos;ri javob boshqa yozilishda xato sanalgan (0.5 va 1/2) · kuchli o&apos;quvchilar bir xil boshqa javob bergan · ko&apos;pchilik bir xil boshqa
        javob bergan · o&apos;quvchi xabar bergan. Tekshirib bo&apos;lgan savolni <b>«Ko&apos;rdim»</b> bilan yashiring — kalit o&apos;zgarsa, yana chiqadi.
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.level}
            onClick={() => setLevel(l.level)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${level === l.level ? 'border-ink bg-ink text-white' : 'border-line text-ink-soft hover:text-ink'}`}
          >
            {l.dot && <span className={`size-2 rounded-full ${l.dot}`} />}
            {l.label} ({countAt(l.level)})
          </button>
        ))}
        <select value={where} onChange={(e) => setWhere(e.target.value as typeof where)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] font-bold">
          <option value="all">Bot + sayt</option>
          <option value="site">Savoli saytda bor</option>
          <option value="bot">Faqat botda (matnsiz)</option>
        </select>
        <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mock nomi yoki bot kodi..." className="w-full rounded-lg border border-line py-1.5 pl-8 pr-3 text-[12.5px] focus:border-green focus:outline-none" />
        </div>
        <label className="flex cursor-pointer select-none items-center gap-1.5 text-[12px] font-bold text-ink-soft">
          <input type="checkbox" checked={showSeen} onChange={(e) => setShowSeen(e.target.checked)} /> Ko&apos;rilganlar ham ({(data?.rows.length ?? 0) - open.length})
        </label>
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-bold hover:bg-slate-50 disabled:opacity-50">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Qayta tekshirish
        </button>
      </div>

      {error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">{error}</div>}
      {!data && !error && (
        <div className="flex items-center gap-2 text-[13px] text-ink-faint">
          <Loader2 size={14} className="animate-spin" /> Barcha javoblar tekshirilmoqda…
        </div>
      )}
      {data && (
        <p className="mb-3 text-[12px] text-ink-faint">
          {data.checkedMocks} ta test, {data.checkedQuestions} ta savol tekshirildi · {shown.length} ta savol ko&apos;rsatilmoqda ({groups.length} ta testda)
        </p>
      )}

      <div className="space-y-3">
        {groups.map((g) => (
          <MockGroup key={g.key} rows={g.rows} top={g.top} onEdit={onEdit} seen={seen} markSeen={markSeen} onFixed={load} />
        ))}
        {data && groups.length === 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] font-bold text-emerald-800">
            <CheckCircle2 size={16} /> Bu filtr bo&apos;yicha shubhali savol yo&apos;q.
          </div>
        )}
      </div>
    </div>
  )
}

function MockGroup({
  rows,
  top,
  onEdit,
  seen,
  markSeen,
  onFixed,
}: {
  rows: AuditRow[]
  top: number
  onEdit?: (label: string) => void
  seen: Set<string>
  markSeen: (r: AuditRow, on: boolean) => void
  onFixed: () => void
}) {
  const first = rows[0]
  const lv = levelOf(top)
  const codes = [...new Set(rows.map((r) => r.botCode).filter(Boolean))] as string[]
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-bg-deep/40 px-3 py-2.5">
        <span className={`size-2.5 shrink-0 rounded-full ${lv.dot}`} />
        <span className="text-[14px] font-extrabold text-ink">{first.testLabel ?? first.mockName}</span>
        {codes.map((c) => (
          <span key={c} className="rounded-full bg-sky-100 px-2 py-px font-mono text-[11px] font-extrabold text-sky-800">
            bot kodi: {c}
          </span>
        ))}
        {!first.testLabel && <span className="rounded-full bg-amber-100 px-2 py-px text-[10.5px] font-extrabold text-amber-800">saytda yo&apos;q — faqat raqamlar</span>}
        <span className="text-[12px] font-bold text-ink-faint">{rows.length} ta savol</span>
        {first.testLabel && onEdit && (
          <button onClick={() => onEdit(first.testLabel!)} className="ml-auto flex items-center gap-1.5 rounded-lg border border-green bg-green-mist px-2.5 py-1 text-[12px] font-bold text-green-deep hover:bg-white">
            <Pencil size={12} /> Mockni tahrirlash
          </button>
        )}
      </div>
      <div className="divide-y divide-line">
        {rows.map((r) => (
          <AuditItem key={r.id} r={r} isSeen={seen.has(seenToken(r))} markSeen={markSeen} onFixed={onFixed} />
        ))}
      </div>
    </div>
  )
}

function AuditItem({ r, isSeen, markSeen, onFixed }: { r: AuditRow; isSeen: boolean; markSeen: (r: AuditRow, on: boolean) => void; onFixed: () => void }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState<(Question & { kind?: 'reading' | 'math' }) | null>(null)
  const [qErr, setQErr] = useState<string | null>(null)
  const [value, setValue] = useState(r.suggested ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const lv = levelOf(r.level)
  const max = Math.max(1, ...r.dist.map((d) => d.c))
  const type = question?.type ?? r.type

  useEffect(() => {
    if (!open || !r.questionId || question) return
    let off = false
    fetch(`/api/admin/questions/${encodeURIComponent(r.questionId)}`)
      .then(async (res) => {
        const d = await res.json()
        if (off) return
        if (res.ok) setQuestion(d.question)
        else setQErr(d.error ?? 'Savol topilmadi.')
      })
      .catch(() => !off && setQErr("Server bilan bog'lanib bo'lmadi."))
    return () => {
      off = true
    }
  }, [open, r.questionId, question])

  async function fix() {
    if (!r.questionId) return
    const v = value.trim()
    const isMcq = type !== 'gridin'
    if (isMcq && !/^[ABCD]$/i.test(v)) return setMsg({ ok: false, text: 'A, B, C yoki D kiriting.' })
    if (!isMcq && !v) return setMsg({ ok: false, text: 'Javobni kiriting.' })
    if (!window.confirm(`${r.qNo}-savol kaliti "${isMcq ? v.toUpperCase() : v}" ga o'zgartirilsinmi? Saytda shu mockni yechganlar natijasi qayta hisoblanadi.`)) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/questions/batch-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: [isMcq ? { id: r.questionId, correct: v.toUpperCase() } : { id: r.questionId, correctValue: v }] }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setMsg({ ok: false, text: d.error ?? "Saqlab bo'lmadi." })
      else {
        setMsg({
          ok: true,
          text: `Saytdagi kalit o'zgardi${d.rescored ? `, ${d.rescored} ta natija qayta hisoblandi` : ''}.${r.botCode ? ` Botda ham (kod ${r.botCode}, ${r.qNo}-savol) kalitni o'zgartiring — bot natijalari botning o'z bazasida hisoblanadi.` : ''}`,
        })
        onFixed()
      }
    } catch {
      setMsg({ ok: false, text: "Server bilan bog'lanib bo'lmadi." })
    }
    setBusy(false)
  }

  return (
    <div className={isSeen ? 'opacity-55' : ''}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-3 py-3">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 basis-[280px] items-start gap-2.5 text-left">
          <span className={`mt-0.5 shrink-0 rounded-lg border px-2 py-1 text-[13px] font-extrabold ${lv.cls}`}>{r.qNo ?? '?'}-savol</span>
          <span className="min-w-0">
            {r.signals.map((s, i) => (
              <span key={i} className="flex items-start gap-1.5 text-[13px] font-semibold leading-snug text-ink">
                {s.code === 'KEY_DIFF' || s.code === 'FORMAT' ? <ShieldAlert size={14} className="mt-0.5 shrink-0 text-red-600" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />}
                {s.text}
              </span>
            ))}
            <span className="mt-1 block text-[12px] text-ink-faint">
              Kalit: <b className="text-ink">{r.botKey ?? r.siteKey ?? '—'}</b>
              {r.botKey && r.siteKey && r.botKey !== r.siteKey.toUpperCase() ? <> (saytda <b className="text-ink">{r.siteKey}</b>)</> : null}
              {r.answered > 0 ? <> · {r.answered} ta javob · to&apos;g&apos;ri {r.correctPct}%</> : <> · hali hech kim yechmagan</>}
              {r.strongN > 0 ? <> · kuchli o&apos;quvchi: {r.strongN}</> : null}
            </span>
          </span>
        </button>

        {/* what the students answered */}
        <div className="w-full shrink-0 space-y-1 sm:w-[230px]">
          {r.dist.slice(0, 4).map((d) => (
            <div key={d.a} className="flex items-center gap-2 text-[12px]">
              <span className={`w-[64px] shrink-0 truncate text-right font-mono font-bold ${d.right ? 'text-emerald-700' : 'text-ink'}`} title={d.a}>
                {d.a}
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span className={`block h-full rounded-full ${d.right ? 'bg-emerald-500' : d.a === r.suggested ? 'bg-red-400' : 'bg-slate-300'}`} style={{ width: `${(100 * d.c) / max}%` }} />
              </span>
              <span className="w-[52px] shrink-0 text-ink-faint">
                {d.c}
                {d.s > 0 ? <span title="shulardan kuchli o'quvchilar"> · ★{d.s}</span> : null}
              </span>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={() => markSeen(r, !isSeen)} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-bold text-ink-soft hover:bg-slate-50" title="Tekshirdim — ro'yxatdan yashirish">
            {isSeen ? <Check size={13} /> : <EyeOff size={13} />} {isSeen ? 'Qaytarish' : "Ko'rdim"}
          </button>
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-bold text-ink-soft hover:bg-slate-50">
            Savol <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-dashed border-line bg-white px-3 py-3">
          {!r.questionId && (
            <p className="text-[12.5px] text-ink-faint">
              Bu test saytdagi mockka ulanmagan, shuning uchun savol matni yo&apos;q — faqat raqam va javoblar. «Bot testlari» bo&apos;limida uni saytdagi mockka ulasangiz, savolning o&apos;zi shu yerda
              ko&apos;rinadi va kalitni shu yerdan tuzatasiz. Hozircha kalitni botning admin panelida tekshiring (kod {r.botCode}, {r.qNo}-savol).
            </p>
          )}
          {r.questionId && !question && !qErr && (
            <div className="flex items-center gap-2 text-[12.5px] text-ink-faint">
              <Loader2 size={13} className="animate-spin" /> Savol yuklanmoqda…
            </div>
          )}
          {qErr && <p className="text-[12.5px] text-red-600">{qErr}</p>}
          {question && <QuestionCard q={question} />}
          {r.questionId && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg-deep/40 p-2.5">
              <span className="text-[12.5px] font-bold text-ink">To&apos;g&apos;ri kalit:</span>
              {type === 'gridin' ? (
                <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="masalan 7/2" className="w-[130px] rounded-lg border border-line bg-white px-2.5 py-1.5 font-mono text-[13px] focus:border-green focus:outline-none" />
              ) : (
                <span className="flex gap-1">
                  {['A', 'B', 'C', 'D'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setValue(c)}
                      className={`size-8 rounded-lg border text-[13px] font-extrabold ${value.toUpperCase() === c ? 'border-green bg-green text-white' : 'border-line bg-white text-ink hover:border-green'}`}
                    >
                      {c}
                    </button>
                  ))}
                </span>
              )}
              <button onClick={fix} disabled={busy || !value.trim()} className="flex items-center gap-1.5 rounded-lg bg-green px-3 py-1.5 text-[12.5px] font-bold text-white hover:brightness-110 disabled:opacity-50">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Kalitni o&apos;zgartirish
              </button>
              {r.suggested && <span className="text-[12px] text-ink-faint">O&apos;quvchilar ko&apos;rsatayotgan javob: <b className="text-ink">{r.suggested}</b> (o&apos;zingiz yechib tekshiring)</span>}
            </div>
          )}
          {msg && (
            <div className={`flex items-start gap-1.5 text-[12.5px] ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {msg.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />} {msg.text}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
