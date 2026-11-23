'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Link2, Loader2, RefreshCw, Search } from 'lucide-react'
import { postJson } from '@/lib/bot-analytics-client'

/**
 * «Sayt ↔ Telegram»: a mock solved on the website counts for a Telegram student only when his site account is linked
 * to his Telegram. Students not linked yet are listed with the most likely site accounts (same name); tap to link.
 */
type Suggest = { userId: string; name: string; phone4: string; web: number; score: number }
type Row = { tg: number; name: string; username: string; groups: string[]; suggestions: Suggest[] }
type Found = { userId: string; name: string; phone4: string }

export function LinksHome({ headers, reload }: { headers?: Record<string, string>; reload: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [linked, setLinked] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Set<number>>(new Set())
  const [q, setQ] = useState('')

  function load() {
    setErr(null)
    fetch('/api/admin/bot-analytics/links', { headers, cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Xatolik')
        setRows(d.rows)
        setLinked(d.linked)
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Server bilan bog'lanib bo'lmadi."))
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function link(pairs: { tgId: number; userId: string }[], key: string) {
    setBusy(key)
    try {
      const r = await postJson<{ done: number; failed: { tgId: number; error: string }[] }>('/api/admin/bot-analytics/links', { pairs }, headers)
      const bad = new Set(r.failed.map((f) => f.tgId))
      setDone((d) => new Set([...d, ...pairs.filter((p) => !bad.has(p.tgId)).map((p) => p.tgId)]))
      if (r.failed.length) alert(r.failed.map((f) => f.error).join('\n'))
      reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Xatolik')
    } finally {
      setBusy(null)
    }
  }

  const exact = useMemo(() => (rows ?? []).filter((r) => !done.has(r.tg) && (r.suggestions[0]?.score ?? 0) >= 0.99), [rows, done])
  const shown = useMemo(() => {
    const w = q.trim().toLowerCase()
    return (rows ?? []).filter((r) => !w || `${r.name} ${r.username}`.toLowerCase().includes(w))
  }, [rows, q])

  if (err)
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-5 text-[13px] font-semibold text-red-600">
        {err}
        <button type="button" className="adm-btn" onClick={load}>
          <RefreshCw size={14} /> Qayta
        </button>
      </div>
    )
  if (!rows)
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-5 text-[13px] text-ink-faint">
        <Loader2 size={15} className="animate-spin" /> Yuklanmoqda...
      </div>
    )

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line bg-white p-4 text-[12.5px] text-ink-soft">
        <b className="text-ink">Nima uchun kerak?</b> O&apos;quvchi mockni saytdan yechsa, natija sayt akkauntiga yoziladi. Tahlil uni Telegram o&apos;quvchisiga
        faqat akkauntlar bog&apos;langan bo&apos;lsa qo&apos;shadi — aks holda u «yechmagan» bo&apos;lib ko&apos;rinadi. Hozir bog&apos;langan: <b className="text-ink">{linked}</b> ta,
        bog&apos;lanmagan: <b className="text-ink">{rows.length}</b> ta.
      </div>

      {exact.length > 0 && (
        <button
          type="button"
          className="adm-btn !h-9"
          disabled={busy === 'all'}
          onClick={() => link(exact.map((r) => ({ tgId: r.tg, userId: r.suggestions[0].userId })), 'all')}
        >
          {busy === 'all' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Ismi aynan mos {exact.length} tasini hammasini bog&apos;lash
        </button>
      )}

      <label className="relative block">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ism bo'yicha qidirish"
          className="w-full rounded-xl border border-line bg-white py-2 pl-8 pr-3 text-[13px] outline-none focus:border-green"
        />
      </label>

      <div className="space-y-2">
        {shown.length === 0 && <p className="py-4 text-[12.5px] text-ink-faint">Hammasi bog&apos;langan.</p>}
        {shown.map((r) => (
          <Item key={r.tg} r={r} done={done.has(r.tg)} busy={busy} headers={headers} onLink={(userId) => link([{ tgId: r.tg, userId }], String(r.tg))} />
        ))}
      </div>
    </div>
  )
}

function Item({ r, done, busy, headers, onLink }: { r: Row; done: boolean; busy: string | null; headers?: Record<string, string>; onLink: (userId: string) => void }) {
  const [search, setSearch] = useState(false)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found[]>([])
  useEffect(() => {
    if (q.trim().length < 2) return setFound([])
    const t = setTimeout(() => {
      fetch(`/api/admin/bot-analytics/links?q=${encodeURIComponent(q.trim())}`, { headers })
        .then((x) => (x.ok ? x.json() : { users: [] }))
        .then((d) => setFound(d.users ?? []))
        .catch(() => setFound([]))
    }, 300)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  const b = busy === String(r.tg)
  const btn = (u: { userId: string; name: string; phone4: string }, extra?: string) => (
    <button
      key={u.userId}
      type="button"
      disabled={b || done}
      onClick={() => onLink(u.userId)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[12px] font-bold text-ink hover:border-green hover:bg-green-mist disabled:opacity-40"
    >
      <Link2 size={12} /> {u.name || '—'} <span className="font-normal text-ink-faint">…{u.phone4}{extra}</span>
    </button>
  )
  return (
    <div className={`rounded-xl border bg-white p-3 ${done ? 'border-green/50 opacity-60' : 'border-line'}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <b className="text-[13px] text-ink">{r.name || `ID ${r.tg}`}</b>
        {r.username && <span className="text-[11.5px] text-ink-faint">@{r.username.replace(/^@/, '')}</span>}
        <span className="text-[11px] text-ink-faint">{r.groups.join(', ')}</span>
        {done && <span className="ml-auto flex items-center gap-1 text-[11.5px] font-bold text-green-deep"><Check size={12} /> bog&apos;landi</span>}
      </div>
      {!done && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {r.suggestions.map((u) => btn(u, u.web ? ` · saytda ${u.web} ta natija` : ''))}
          <button type="button" className="text-[11.5px] font-bold text-ink-soft underline-offset-2 hover:underline" onClick={() => setSearch((v) => !v)}>
            {r.suggestions.length ? 'Boshqasini qidirish' : 'Sayt akkauntini qidirish'}
          </button>
        </div>
      )}
      {search && !done && (
        <div className="mt-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ism yoki telefon oxiri"
            className="w-full rounded-lg border border-line px-3 py-1.5 text-[12.5px] outline-none focus:border-green"
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">{found.map((u) => btn(u))}</div>
        </div>
      )}
    </div>
  )
}
