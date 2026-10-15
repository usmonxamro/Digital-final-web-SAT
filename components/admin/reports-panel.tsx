'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Send, Trash2 } from 'lucide-react'
import type { ReportRow } from '@/app/api/admin/reports/route'

/** Admin "Xato xabarlari": questions students flagged after a mock; the reply lands in their bell. */
export function ReportsPanel() {
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [needSql, setNeedSql] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<Record<string, string>>({})

  async function load() {
    const d = await fetch('/api/admin/reports').then((r) => r.json()).catch(() => null)
    setRows(d?.items ?? [])
    setNeedSql(!!d?.migrationNeeded)
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
                {r.name || 'Noma’lum'} <span className="ml-1 font-semibold text-ink-soft">· {r.test_label}{r.q_number ? ` · Q${r.q_number}` : ''}</span>
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
            {r.prompt && <p className="mt-2 rounded-lg bg-bg px-3 py-2 text-[12px] text-ink-soft">{r.prompt}</p>}
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink">{r.message}</p>
            {r.reply && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-green-mist px-3 py-2 text-[12.5px] text-green-deep">
                <b>Javobingiz:</b> {r.reply}
              </p>
            )}
            <div className="mt-3 flex gap-2">
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
            </div>
            {err[r.id] && <p className="mt-1.5 text-[12px] font-semibold text-red-600">{err[r.id]}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
