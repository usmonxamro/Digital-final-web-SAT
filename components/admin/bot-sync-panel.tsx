'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Link2, Link2Off, Loader2, RefreshCw } from 'lucide-react'
import type { BotSyncOverview, BotTestRow, KeyPreview } from '@/app/api/admin/bot-sync/route'

type View = 'tests' | 'toBot' | 'suspects' | 'groups'
type Filter = 'all' | 'unlinked' | 'linked'

const btn = 'px-3 py-1.5 rounded-lg text-[12.5px] font-bold border border-line hover:bg-slate-50 disabled:opacity-50'
const btnPrimary = 'px-3 py-1.5 rounded-lg text-[12.5px] font-bold bg-green text-white hover:brightness-110 disabled:opacity-50'

/**
 * Admin "Bot ↔ Sayt": the tests that live in the Telegram bot's database (answer keys + who solved them),
 * which of them are already a site mock, and one-click linking (the bot's answer key is copied onto the
 * site mock's questions and re-scores the attempts if a key changed). Also the suspicious keys and group progress.
 */
export function BotSyncPanel() {
  const [data, setData] = useState<BotSyncOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('tests')
  const [filter, setFilter] = useState<Filter>('unlinked')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/bot-sync', { cache: 'no-store' })
      const d = await res.json()
      if (!res.ok) setError(d.error ?? 'Yuklab bo‘lmadi.')
      else setData(d)
    } catch {
      setError("Server bilan bog'lanib bo'lmadi.")
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const unlinkedCount = data?.tests.filter((t) => !t.testLabel).length ?? 0

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(
          [
            ['tests', `Bot testlari${data ? ` (${data.tests.length})` : ''}`],
            ['toBot', `Saytda bor, botda yo'q${data ? ` (${data.siteOnly.length})` : ''}`],
            ['suspects', `Shubhali kalitlar${data ? ` (${data.suspects.length})` : ''}`],
            ['groups', 'Guruhlar'],
          ] as [View, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3.5 py-1.5 rounded-full text-[13px] font-bold border ${view === v ? 'bg-ink text-white border-ink' : 'border-line text-ink-faint hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
        <button onClick={load} className={`${btn} ml-auto flex items-center gap-1.5`} disabled={loading}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Yangilash
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[13px] p-3">{error}</div>}
      {!data && !error && <div className="text-ink-faint text-[13px] flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Yuklanmoqda…</div>}

      {data && view === 'tests' && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3 text-[12.5px]">
            {(
              [
                ['unlinked', `Saytda yo'q (${unlinkedCount})`],
                ['linked', `Saytga ulangan (${data.tests.length - unlinkedCount})`],
                ['all', 'Hammasi'],
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-lg font-bold ${filter === f ? 'bg-slate-100 text-ink' : 'text-ink-faint hover:text-ink'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {data.tests
              .filter((t) => (filter === 'all' ? true : filter === 'unlinked' ? !t.testLabel : !!t.testLabel))
              .map((t) => (
                <TestRow key={t.code} t={t} mocks={data.mocks} onChanged={load} />
              ))}
            {data.tests.length === 0 && <p className="text-ink-faint text-[13px]">Botdan hali test kelmagan.</p>}
          </div>
        </>
      )}

      {data && view === 'toBot' && (
        <div className="space-y-2">
          <p className="text-[12.5px] text-ink-faint mb-1">
            Saytdagi mocklar (Math qismi), botda hali yo&apos;q. Keraklilarini belgilab (yoki hammasini) botga yuboring: har biriga bot kodi beriladi, bot ~1 daqiqada oladi va adminlarga
            xabar yuboradi. Javoblar to&apos;liq kiritilgan bo&apos;lishi kerak. Bundan keyin nashr qilinadigan mocklar botga o&apos;zi qo&apos;shiladi.
          </p>
          {data.siteOnly.length > 0 && <PickToBot mocks={data.siteOnly} onDone={load} />}
          {data.siteOnly.length === 0 && <p className="text-ink-faint text-[13px]">Hamma mock botda bor.</p>}
        </div>
      )}

      {data && view === 'suspects' && (
        <div>
          <p className="text-[12.5px] text-ink-faint mb-3">
            Ko'p o'quvchi bir xil javob bergan-u, kalitga deyarli hech kim mos kelmagan savollar. Kalit botda saqlanadi: to'g'rilash uchun botdagi
            admin panelda kalitni o'zgartiring (sayt ulangan bo'lsa, keyingi sinxronda o'zi yangilanadi va "Bot testlari"dan qayta solishtirasiz).
          </p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-ink-faint text-left">
                <tr>
                  <th className="p-2">Test</th><th className="p-2">Savol</th><th className="p-2">Kalit</th>
                  <th className="p-2">Eng ko'p javob</th><th className="p-2">To'g'ri %</th><th className="p-2">Urinish</th><th className="p-2">Holat</th>
                </tr>
              </thead>
              <tbody>
                {data.suspects.map((s) => (
                  <tr key={`${s.botCode}-${s.qNo}`} className="border-t border-line">
                    <td className="p-2 font-semibold">{s.mockName ?? s.botCode}{s.testLabel ? <span className="text-ink-faint font-normal"> → {s.testLabel}</span> : null}</td>
                    <td className="p-2">{s.qNo}</td>
                    <td className="p-2 font-bold">{s.keyAnswer ?? '—'}</td>
                    <td className="p-2">{s.topWrongAnswer ?? '—'} <span className="text-ink-faint">({s.topWrongPct}%)</span></td>
                    <td className="p-2">{s.correctPct}%</td>
                    <td className="p-2">{s.attempts}</td>
                    <td className="p-2">
                      <span className={`font-bold ${s.flag.startsWith('1') ? 'text-red-600' : 'text-amber-600'}`}>{s.flag.slice(2)}</span>
                    </td>
                  </tr>
                ))}
                {data.suspects.length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-center text-ink-faint">Shubhali kalit topilmadi.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && view === 'groups' && (
        <div className="grid sm:grid-cols-2 gap-3">
          {data.groups.map((g) => (
            <div key={g.chatId} className="rounded-xl border border-line p-4">
              <div className="font-bold text-[14px]">{g.title ?? g.chatId}</div>
              <div className="text-[12.5px] text-ink-faint mt-1">{g.members} ta o'quvchi · {g.assigned} ta mock berilgan</div>
              <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${g.doneRate ?? 0}%` }} />
              </div>
              <div className="text-[12.5px] mt-1 font-semibold">Bajarilgan: {g.doneRate ?? 0}%</div>
            </div>
          ))}
          {data.groups.length === 0 && <p className="text-ink-faint text-[13px]">Guruhlarga hali mock berilmagan.</p>}
        </div>
      )}
    </div>
  )
}

function TestRow({ t, mocks, onChanged }: { t: BotTestRow; mocks: BotSyncOverview['mocks']; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(t.testLabel ?? t.suggestion ?? '')
  const [preview, setPreview] = useState<KeyPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const counts = useMemo(() => {
    const c = { same: 0, new: 0, change: 0, mismatch: 0 }
    preview?.rows.forEach((r) => c[r.status]++)
    return c
  }, [preview])

  async function post(body: object) {
    const res = await fetch('/api/admin/bot-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    return { ok: res.ok, d }
  }

  async function check() {
    setBusy(true)
    setMsg(null)
    setPreview(null)
    const { ok, d } = await post({ action: 'preview', code: t.code, label })
    if (ok) setPreview(d)
    else setMsg({ ok: false, text: d.error ?? 'Tekshirib bo‘lmadi.' })
    setBusy(false)
  }

  async function apply() {
    if (!preview) return
    if (counts.mismatch > 0 && !window.confirm(`${counts.mismatch} ta savolning turi mos kelmaydi (A–D va yozma javob). Ular o'zgarmaydi. Davom etilsinmi?`)) return
    if (counts.change > 0 && !window.confirm(`${counts.change} ta savolning saytdagi kaliti BOTDAGI kalit bilan almashtiriladi va shu mockni yechganlar natijasi qayta hisoblanadi. Davom etilsinmi?`)) return
    setBusy(true)
    setMsg(null)
    let note = ''
    if (preview.patches.length > 0) {
      const res = await fetch('/api/admin/questions/batch-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: preview.patches }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ ok: false, text: d.error ?? 'Kalitlarni saqlab bo‘lmadi.' })
        setBusy(false)
        return
      }
      note = ` ${preview.patches.length} ta javob yozildi${d.rescored ? `, ${d.rescored} ta urinish qayta hisoblandi` : ''}.`
    }
    const { ok, d } = await post({ action: 'link', code: t.code, label })
    if (!ok) {
      setMsg({ ok: false, text: d.error ?? 'Bog‘lab bo‘lmadi.' })
      setBusy(false)
      return
    }
    setMsg({ ok: true, text: `Ulandi: ${t.code} → ${label}.${note}` })
    setBusy(false)
    setPreview(null)
    onChanged()
  }

  async function unlink() {
    if (!window.confirm('Bog‘lanish uzilsinmi? (Savollar va natijalar o‘chmaydi.)')) return
    setBusy(true)
    const { ok, d } = await post({ action: 'unlink', code: t.code })
    setBusy(false)
    if (ok) onChanged()
    else setMsg({ ok: false, text: d.error ?? 'Uzib bo‘lmadi.' })
  }

  return (
    <div className="rounded-xl border border-line">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-bold text-[14px]">{t.name ?? t.code}</span>
        <span className="text-[12px] text-ink-faint">kod: {t.code} · {t.questionCount} ta savol · {t.attempts} urinish · {t.students} o'quvchi</span>
        <span className={`ml-auto text-[12px] font-bold flex items-center gap-1 ${t.testLabel ? 'text-emerald-600' : 'text-amber-600'}`}>
          {t.testLabel ? <><Link2 size={13} /> {t.testLabel}</> : <><Link2Off size={13} /> Saytda yo'q</>}
        </span>
      </button>

      {open && (
        <div className="border-t border-line p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={label} onChange={(e) => { setLabel(e.target.value); setPreview(null) }} className="border border-line rounded-lg px-2 py-1.5 text-[13px] min-w-[220px] bg-white">
              <option value="">— saytdagi mockni tanlang —</option>
              {mocks.map((m) => <option key={m.label} value={m.label}>{m.label}</option>)}
            </select>
            <button className={btn} disabled={!label || busy} onClick={check}>
              {busy && !preview ? <Loader2 size={13} className="animate-spin inline" /> : null} Kalitlarni solishtirish
            </button>
            {t.testLabel && <button className={btn} disabled={busy} onClick={unlink}>Uzish</button>}
          </div>
          {!t.testLabel && !t.suggestion && (
            <p className="text-[12.5px] text-ink-faint">
              Bu test saytda hali yo'q. Avval "Yangi mock qo'shish"dan savollarni (javobsiz) JSON/LaTeX bilan yuklang, so'ng bu yerda tanlab ulang — javoblar botdan o'zi tushadi.
            </p>
          )}

          {preview && (
            <div className="text-[13px] space-y-2">
              <div>
                Botda {preview.botCount} ta javob, saytda {preview.siteCount} ta savol:&nbsp;
                <b className="text-emerald-600">{counts.new} yangi</b>, <b className="text-amber-600">{counts.change} o'zgaradi</b>,{' '}
                {counts.same} bir xil{counts.mismatch ? <>, <b className="text-red-600">{counts.mismatch} turi mos emas</b></> : null}.
              </div>
              {preview.rows.filter((r) => r.status === 'change' || r.status === 'mismatch').slice(0, 12).map((r) => (
                <div key={r.no} className="text-[12.5px] text-ink-faint">
                  {r.no}-savol: saytda <b>{r.siteAnswer ?? '—'}</b> → botda <b>{r.botAnswer || '—'}</b>{r.status === 'mismatch' ? ' (tur mos emas)' : ''}
                </div>
              ))}
              <button className={btnPrimary} disabled={busy} onClick={apply}>
                {busy ? <Loader2 size={13} className="animate-spin inline" /> : <CheckCircle2 size={13} className="inline" />} Qo'llash va ulash
              </button>
            </div>
          )}

          {msg && (
            <div className={`text-[12.5px] flex items-start gap-1.5 ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {msg.ok ? <CheckCircle2 size={14} className="mt-0.5" /> : <AlertTriangle size={14} className="mt-0.5" />} {msg.text}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Site mocks the bot does not have yet: tick the ones you want (or all) and send them to the bot in one go.
 * Each gets a bot code; the bot saves it within a minute and messages the admins.
 */
function PickToBot({ mocks, onDone }: { mocks: BotSyncOverview['siteOnly']; onDone: () => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Record<string, { ok: boolean; text: string }>>({})
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null)

  const shown = mocks.filter((m) => !q.trim() || m.label.toLowerCase().includes(q.trim().toLowerCase()))
  const allOn = shown.length > 0 && shown.every((m) => sel.has(m.label))
  const toggle = (l: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(l)) n.delete(l)
      else n.add(l)
      return n
    })

  async function run() {
    const labels = mocks.map((m) => m.label).filter((l) => sel.has(l))
    if (labels.length === 0) return
    if (!window.confirm(`${labels.length} ta mock botga qo'shilsinmi? Har biriga bot kodi beriladi va bot adminlarga xabar yuboradi.`)) return
    setBusy(true)
    setProg({ done: 0, total: labels.length })
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i]
      let r: { ok: boolean; text: string }
      try {
        const x = await fetch('/api/admin/bot-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'to_bot', label }) })
        const d = await x.json().catch(() => ({}))
        r = { ok: d.status === 'created' || d.status === 'exists', text: d.status === 'created' ? `kod ${d.code}` : (d.message ?? d.error ?? 'Xatolik.') }
      } catch {
        r = { ok: false, text: "Server bilan bog'lanib bo'lmadi." }
      }
      setRes((m) => ({ ...m, [label]: r }))
      setProg({ done: i + 1, total: labels.length })
    }
    setBusy(false)
    setSel(new Set())
    onDone()
  }

  const okN = Object.values(res).filter((r) => r.ok).length
  const badN = Object.values(res).filter((r) => !r.ok).length

  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line bg-bg-deep/40">
        <label className="flex items-center gap-2 text-[13px] font-bold cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allOn}
            onChange={() =>
              setSel((s) => {
                const n = new Set(s)
                if (allOn) shown.forEach((m) => n.delete(m.label))
                else shown.forEach((m) => n.add(m.label))
                return n
              })
            }
          />
          Hammasini belgilash
        </label>
        <button
          className={btn}
          disabled={busy}
          onClick={() => setSel(new Set(mocks.filter((m) => m.published).map((m) => m.label)))}
          title="Faqat o'quvchilarga ochiq mocklarni belgilash"
        >
          Faqat nashr qilinganlar
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Qidirish…"
          className="border border-line rounded-lg px-2.5 py-1.5 text-[13px] bg-white min-w-[160px] flex-1 sm:flex-none"
        />
        <button className={`${btnPrimary} ml-auto`} disabled={busy || sel.size === 0} onClick={run}>
          {busy ? <Loader2 size={13} className="animate-spin inline" /> : null} Tanlanganlarni botga qo&apos;shish ({sel.size})
        </button>
      </div>
      {prog && (
        <div className="px-3 py-2 text-[12.5px] border-b border-line">
          {prog.done} / {prog.total} bajarildi · <span className="text-emerald-700 font-bold">{okN} ta botda</span>
          {badN > 0 && <span className="text-amber-700 font-bold"> · {badN} ta qo&apos;shilmadi (sababi qatorda)</span>}
        </div>
      )}
      <div className="max-h-[520px] overflow-y-auto divide-y divide-line">
        {shown.map((m) => {
          const r = res[m.label]
          return (
            <label key={m.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 cursor-pointer hover:bg-bg-deep/40">
              <input type="checkbox" checked={sel.has(m.label)} onChange={() => toggle(m.label)} disabled={busy} />
              <span className="font-bold text-[13.5px]">{m.label}</span>
              <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${m.published ? 'bg-green-mist text-green-deep' : 'bg-amber-100 text-amber-800'}`}>
                {m.published ? 'nashr qilingan' : 'qoralama'}
              </span>
              <span className="text-[11.5px] text-ink-faint">{m.subject === 'full' ? 'Full (Math qismi)' : 'Math'}</span>
              {r && <span className={`basis-full sm:basis-auto sm:ml-auto text-[12px] ${r.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{r.ok ? '✓ ' : '⚠ '}{r.text}</span>}
            </label>
          )
        })}
        {shown.length === 0 && <div className="p-4 text-[13px] text-ink-faint">Hech narsa topilmadi.</div>}
      </div>
    </div>
  )
}
