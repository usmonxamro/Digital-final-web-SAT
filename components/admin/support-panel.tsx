'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Trash2, MailOpen, Mail } from 'lucide-react'
import type { SupportRow } from '@/app/api/admin/support/route'

/** Admin "Xabarlar": messages + screenshots students send from the help centre. */
export function SupportPanel() {
  const [rows, setRows] = useState<SupportRow[] | null>(null)
  const [needSql, setNeedSql] = useState(false)
  const [zoom, setZoom] = useState<string | null>(null)

  async function load() {
    const d = await fetch('/api/admin/support').then((r) => r.json()).catch(() => null)
    setRows(d?.messages ?? [])
    setNeedSql(!!d?.migrationNeeded)
  }
  useEffect(() => {
    load()
  }, [])

  async function call(method: 'PATCH' | 'DELETE', body: object) {
    await fetch('/api/admin/support', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    load()
  }

  if (!rows) {
    return (
      <div className="flex items-center gap-2 py-6 text-[13px] text-ink-faint">
        <Loader2 size={15} className="animate-spin" /> Yuklanmoqda...
      </div>
    )
  }
  return (
    <div>
      {needSql && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Xabarlar jadvali yo&apos;q — supabase/schema.sql oxiridagi v62 qismini ishga tushiring.
        </div>
      )}
      {rows.length === 0 && !needSql && <p className="text-[13px] text-ink-faint">Hozircha xabar yo&apos;q.</p>}
      <div className="flex flex-col gap-3">
        {rows.map((m) => (
          <div key={m.id} className={`rounded-xl border bg-white p-4 ${m.read ? 'border-line' : 'border-green'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-extrabold text-ink">
                {m.name || 'Noma’lum'}
                {m.contact && <span className="ml-2 font-semibold text-ink-soft">{m.contact}</span>}
              </div>
              <div className="flex items-center gap-2 text-[11.5px] text-ink-faint">
                {new Date(m.created_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
                <button onClick={() => call('PATCH', { id: m.id, read: !m.read })} title={m.read ? 'O‘qilmagan qilish' : 'O‘qildi'} className="hover:text-green">
                  {m.read ? <Mail size={15} /> : <MailOpen size={15} />}
                </button>
                <button onClick={() => confirm('O‘chirilsinmi?') && call('DELETE', { id: m.id })} title="O‘chirish" className="hover:text-red-600">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-ink">{m.message}</p>
            {m.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image} alt="Skrinshot" onClick={() => setZoom(m.image)} className="mt-3 max-h-40 cursor-zoom-in rounded-lg border border-line" />
            )}
          </div>
        ))}
      </div>
      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Skrinshot" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}
