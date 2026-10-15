'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Send, Trash2 } from 'lucide-react'
import type { BroadcastRow } from '@/app/api/admin/notifications/route'

/** Admin "Bildirishnoma": one message to every student's bell (also pops up on their screen). */
export function NotifyPanel() {
  const [rows, setRows] = useState<BroadcastRow[] | null>(null)
  const [needSql, setNeedSql] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    const d = await fetch('/api/admin/notifications').then((r) => r.json()).catch(() => null)
    setRows(d?.items ?? [])
    setNeedSql(!!d?.migrationNeeded)
  }
  useEffect(() => {
    load()
  }, [])

  async function send() {
    if (busy || (!title.trim() && !body.trim())) return
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setMsg({ ok: false, text: d.error ?? 'Xato' })
    setTitle('')
    setBody('')
    setMsg({ ok: true, text: 'Yuborildi — barcha o‘quvchilarning qo‘ng‘iroqchasiga tushadi.' })
    load()
  }

  return (
    <div className="flex flex-col gap-4">
      {needSql && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Jadval yo&apos;q — supabase/schema.sql oxiridagi v71 qismini ishga tushiring.
        </div>
      )}
      <div className="rounded-2xl border border-line bg-white p-5">
        <h3 className="text-[15px] font-extrabold text-ink">Hammaga xabar yuborish</h3>
        <p className="mb-3 text-[12px] text-ink-faint">Xabar har bir o‘quvchining qo‘ng‘iroqchasiga tushadi va saytga kirganda ekranda chiroyli chiqadi.</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Sarlavha (masalan: Yangi mock qo‘shildi!)"
          className="mb-2 w-full rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-green"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1500}
          rows={4}
          placeholder="Xabar matni..."
          className="w-full rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-green"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={send}
            disabled={busy || (!title.trim() && !body.trim())}
            className="flex items-center gap-1.5 rounded-lg bg-green px-4 py-2 text-[13px] font-extrabold text-white hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Hammaga yuborish
          </button>
          {msg && <span className={`text-[12px] font-semibold ${msg.ok ? 'text-green-deep' : 'text-red-600'}`}>{msg.text}</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5">
        <h3 className="mb-2 text-[14px] font-extrabold text-ink">Yuborilganlar</h3>
        {!rows ? (
          <Loader2 size={15} className="animate-spin text-ink-faint" />
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-ink-faint">Hali xabar yuborilmagan.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-ink">{r.title}</div>
                  <div className="whitespace-pre-wrap text-[12.5px] text-ink-soft">{r.body}</div>
                  <div className="mt-0.5 text-[11px] text-ink-faint">{new Date(r.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}</div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('O‘chirilsinmi?')) return
                    await fetch('/api/admin/notifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) })
                    load()
                  }}
                  title="O‘chirish"
                  className="shrink-0 text-ink-faint hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
