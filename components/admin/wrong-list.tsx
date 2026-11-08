'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ClipboardCopy, Eye, EyeOff, Layers, Loader2, Minus, Plus, ShoppingBasket, Trash2, X } from 'lucide-react'
import type { QuestionStat } from '@/lib/bot-analytics'
import type { Question } from '@/lib/test-data'
import { QuestionCard } from '@/components/admin/question-card'
import { basket, itemKey, numberList, useBasket, type BasketItem } from '@/components/admin/review-basket'

type Mapped = Question & { no: number; kind: 'reading' | 'math' }

function useCopied(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null)
  return [
    copied,
    (key, text) => {
      navigator.clipboard?.writeText(text).catch(() => {})
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    },
  ]
}

/**
 * «Xato qilingan savollar ro'yxati» for one bot test: every question number someone got wrong, each once, in
 * increasing order (copyable), filterable by how many students missed it; optionally with the question text
 * (when the test was published from the site) and a button to collect them into a «takrorlash» mock.
 */
export function WrongList({
  code,
  name,
  questions,
  headers,
}: {
  code: string
  name: string
  questions: QuestionStat[]
  headers?: Record<string, string>
}) {
  const [min, setMin] = useState(1)
  const [order, setOrder] = useState<'no' | 'most'>('no')
  const [showText, setShowText] = useState(false)
  const [mapped, setMapped] = useState<{ linked: boolean; byNo: Map<number, Mapped> } | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, copy] = useCopied()
  const bag = useBasket()
  const inBag = useMemo(() => new Set(bag.map(itemKey)), [bag])

  const wrong = useMemo(() => {
    const list = questions.filter((q) => q.wrong >= min)
    return order === 'no' ? [...list].sort((a, b) => a.no - b.no) : [...list].sort((a, b) => b.wrong - a.wrong || a.no - b.no)
  }, [questions, min, order])
  const maxWrong = Math.max(1, ...questions.map((q) => q.wrong))
  const text = numberList(wrong.map((q) => q.no))

  // The site texts behind the bot numbers (needed for the text view and to make a site mock from the basket).
  useEffect(() => {
    if (mapped || loading) return
    setLoading(true)
    fetch(`/api/admin/bot-questions?code=${encodeURIComponent(code)}`, { headers })
      .then((r) => (r.ok ? r.json() : { linked: false, items: [] }))
      .then((d) => setMapped({ linked: !!d.linked, byNo: new Map(((d.items ?? []) as Mapped[]).map((q) => [q.no, q])) }))
      .catch(() => setMapped({ linked: false, byNo: new Map() }))
      .finally(() => setLoading(false))
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  // Questions put in the basket before the texts arrived get their site id now.
  useEffect(() => {
    if (!mapped?.linked) return
    const fix = bag
      .filter((x) => x.code === code && !x.qid && mapped.byNo.get(x.no)?.id)
      .map((x) => ({ ...x, qid: mapped.byNo.get(x.no)!.id as string }))
    if (fix.length) basket.add(fix)
  }, [mapped, bag, code])

  const toItem = (q: QuestionStat): BasketItem => ({ code, name, no: q.no, qid: (mapped?.byNo.get(q.no)?.id as string | undefined) ?? null, wrongPct: Math.round(q.wrongPct) })
  const allIn = wrong.length > 0 && wrong.every((q) => inBag.has(itemKey({ code, no: q.no })))

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-extrabold text-ink">Xato qilingan savollar ro&apos;yxati</h3>
          <p className="text-[11.5px] text-ink-faint">Har bir raqam bir marta, o&apos;sish tartibida · {wrong.length} ta savol</p>
        </div>
        <label className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
          Kamida
          <span className="inline-flex items-center rounded-lg border border-line">
            <button type="button" className="px-1.5 py-1 hover:text-ink" onClick={() => setMin((m) => Math.max(1, m - 1))} aria-label="Kamaytirish">
              <Minus size={12} />
            </button>
            <b className="w-6 text-center tabular-nums text-ink">{min}</b>
            <button type="button" className="px-1.5 py-1 hover:text-ink" onClick={() => setMin((m) => Math.min(maxWrong, m + 1))} aria-label="Ko'paytirish">
              <Plus size={12} />
            </button>
          </span>
          kishi xato qilgan
        </label>
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value as 'no' | 'most')}
          className="rounded-lg border border-line bg-white px-2 py-1.5 text-[12px] font-bold text-ink"
        >
          <option value="no">Raqam bo&apos;yicha</option>
          <option value="most">Ko&apos;p xato bo&apos;yicha</option>
        </select>
      </div>

      {wrong.length === 0 ? (
        <p className="text-[12.5px] text-ink-faint">Bu shart bo&apos;yicha xato qilingan savol yo&apos;q.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {wrong.map((q) => {
              const k = itemKey({ code, no: q.no })
              const on = inBag.has(k)
              return (
                <button
                  key={q.no}
                  type="button"
                  onClick={() => (on ? basket.remove([k]) : basket.add([toItem(q)]))}
                  title={`${q.no}-savol: ${q.wrong}/${q.n} kishi xato (${Math.round(q.wrongPct)}%) — bosing: takrorlash to'plamiga ${on ? 'olib tashlash' : "qo'shish"}`}
                  className={`inline-flex items-baseline gap-1 rounded-lg border px-2 py-1 text-[12.5px] font-extrabold tabular-nums transition ${
                    on ? 'border-green bg-green-mist text-green-deep' : 'border-line text-ink hover:border-ink-faint'
                  }`}
                >
                  {q.no}
                  <small className="text-[10px] font-semibold text-ink-faint">×{q.wrong}</small>
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 max-w-full flex-1 truncate rounded-lg bg-bg-deep px-2.5 py-1.5 font-mono text-[12px] text-ink-soft" title={text}>
              {text}
            </code>
            <button type="button" className="adm-btn !h-8" onClick={() => copy('nums', text)}>
              {copied === 'nums' ? <Check size={14} /> : <ClipboardCopy size={14} />} {copied === 'nums' ? 'Nusxalandi' : 'Nusxalash'}
            </button>
            <button
              type="button"
              className="adm-btn !h-8"
              onClick={() => (allIn ? basket.remove(wrong.map((q) => itemKey({ code, no: q.no }))) : basket.add(wrong.map(toItem)))}
            >
              <ShoppingBasket size={14} /> {allIn ? "To'plamdan olish" : "Hammasini to'plamga"}
            </button>
            <button type="button" className="adm-btn !h-8" onClick={() => setShowText((v) => !v)}>
              {showText ? <EyeOff size={14} /> : <Eye size={14} />} {showText ? 'Matnni yashirish' : 'Matni bilan ko‘rish'}
            </button>
          </div>

          {showText && (
            <div className="mt-4 space-y-3">
              {loading && (
                <div className="flex items-center gap-2 text-[12.5px] text-ink-faint">
                  <Loader2 size={14} className="animate-spin" /> Savollar yuklanmoqda...
                </div>
              )}
              {mapped && !mapped.linked && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
                  Bu test faqat botda yaratilgan — savollar matni saytda yo&apos;q. Raqamlar ro&apos;yxati yuqorida; to&apos;plamga qo&apos;shsangiz ham
                  «qaysi mockdan qaysi savollar» ko&apos;rinishida saqlanadi.
                </p>
              )}
              {mapped?.linked &&
                wrong.map((q) => {
                  const mq = mapped.byNo.get(q.no)
                  const k = itemKey({ code, no: q.no })
                  const on = inBag.has(k)
                  return (
                    <div key={q.no} className="rounded-xl border border-line p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px]">
                        <b className="text-ink">{q.no}-savol</b>
                        <span className="rounded-full bg-red-50 px-2 py-px font-bold text-red-700">
                          {q.wrong}/{q.n} xato · {Math.round(q.wrongPct)}%
                        </span>
                        {mq?.domain && <span className="text-ink-faint">{mq.domain}</span>}
                        <button
                          type="button"
                          onClick={() => (on ? basket.remove([k]) : basket.add([toItem(q)]))}
                          className={`ml-auto inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11.5px] font-bold ${
                            on ? 'border-green bg-green-mist text-green-deep' : 'border-line text-ink-soft hover:border-green'
                          }`}
                        >
                          {on ? <Check size={13} /> : <Plus size={13} />} {on ? "To'plamda" : "To'plamga"}
                        </button>
                      </div>
                      {mq ? <QuestionCard q={mq} compact /> : <p className="text-[12px] text-ink-faint">Saytda bu raqamga mos savol topilmadi.</p>}
                    </div>
                  )
                })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * «Takrorlash to'plami» bar: questions collected from any number of mocks. Shows "which mock → which numbers",
 * copies that as text, and (site admin only) turns the questions that have a site text into a new draft mock.
 */
export function ReviewBasketBar({ canCreate }: { canCreate: boolean }) {
  const bag = useBasket()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, copy] = useCopied()

  const byMock = useMemo(() => {
    const m = new Map<string, { name: string; items: BasketItem[] }>()
    for (const x of bag) {
      const g = m.get(x.code) ?? { name: x.name, items: [] }
      g.items.push(x)
      m.set(x.code, g)
    }
    for (const g of m.values()) g.items.sort((a, b) => a.no - b.no)
    return [...m.entries()]
  }, [bag])
  const onSite = bag.filter((x) => x.qid)
  const summary = byMock.map(([code, g]) => `${g.name} (kod ${code}): ${numberList(g.items.map((x) => x.no))}`).join('\n')

  if (bag.length === 0) return null

  async function create() {
    if (!title.trim() || busy) return
    setBusy(true)
    setMsg(null)
    // Mock by mock, numbers increasing — the review mock keeps a natural order.
    const ids = byMock.flatMap(([, g]) => g.items.filter((x) => x.qid).map((x) => x.qid as string))
    const res = await fetch('/api/admin/review-mock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), questionIds: ids }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (!res?.ok) return setMsg({ ok: false, text: d?.error ?? 'Yaratib bo‘lmadi.' })
    setMsg({ ok: true, text: `"${d.testLabel}" yaratildi — ${d.count} ta savol, DRAFT holatida. «Mocklar» bo‘limida ko‘rib chiqib, nashr qiling yoki guruhga bering.` })
    setTitle('')
  }

  return (
    <div className="sticky bottom-3 z-20 rounded-2xl border border-green bg-white shadow-[0_10px_40px_rgba(0,0,0,.12)]">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <ShoppingBasket size={17} className="text-green-deep" />
        <b className="text-[13px] text-ink">
          Takrorlash to&apos;plami: {bag.length} ta savol
          <span className="ml-1 font-semibold text-ink-soft">
            ({byMock.length} ta mockdan{onSite.length < bag.length ? ` · ${bag.length - onSite.length} tasi faqat botda` : ''})
          </span>
        </b>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className="adm-btn !h-8" onClick={() => setOpen((v) => !v)}>
            <Layers size={14} /> {open ? 'Yopish' : "Ko'rish"}
          </button>
          <button
            type="button"
            className="adm-btn !h-8"
            onClick={() => confirm("To'plam tozalansinmi?") && basket.clear()}
            title="To'plamni tozalash"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {open && (
        <div className="max-h-[50vh] overflow-auto border-t border-line px-4 py-3">
          <div className="space-y-1.5">
            {byMock.map(([code, g]) => (
              <div key={code} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                <b className="text-ink">{g.name}</b>
                <span className="font-mono text-[11px] text-ink-faint">kod {code}</span>
                <span className="flex flex-wrap gap-1">
                  {g.items.map((x) => (
                    <button
                      key={x.no}
                      type="button"
                      onClick={() => basket.remove([itemKey(x)])}
                      title="Olib tashlash"
                      className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-px text-[11.5px] font-bold tabular-nums hover:border-red-400 hover:text-red-600 ${
                        x.qid ? 'border-green/60 text-ink' : 'border-dashed border-line text-ink-soft'
                      }`}
                    >
                      {x.no}
                      <X size={10} />
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="adm-btn !h-8" onClick={() => copy('sum', summary)}>
              {copied === 'sum' ? <Check size={14} /> : <ClipboardCopy size={14} />} Ro&apos;yxatni matn qilib nusxalash
            </button>
            <span className="text-[11px] text-ink-faint">Yashil chegarali — saytda matni bor; uzuq chiziqli — faqat botda (raqam sifatida).</span>
          </div>
          {canCreate && (
            <div className="mt-3 rounded-xl bg-bg-deep p-3">
              <div className="mb-1.5 text-[12px] font-extrabold text-ink">Saytda takrorlash mocki yaratish ({onSite.length} ta savol)</div>
              {onSite.length === 0 ? (
                <p className="text-[12px] text-ink-faint">To&apos;plamda saytda matni bor savol yo&apos;q.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Masalan: Takrorlash Mock 1 — Dekabr guruhi"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] outline-none focus:border-green"
                  />
                  <button
                    type="button"
                    onClick={create}
                    disabled={busy || !title.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green px-3 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Mock yaratish (DRAFT)
                  </button>
                </div>
              )}
              {onSite.length > 44 && <p className="mt-1.5 text-[11.5px] font-semibold text-amber-700">Bitta mockka ko‘pi bilan 44 ta Math savol sig‘adi — to‘plamni ikkiga bo‘ling.</p>}
              {msg && <p className={`mt-2 text-[12px] font-semibold ${msg.ok ? 'text-green-deep' : 'text-red-600'}`}>{msg.text}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
