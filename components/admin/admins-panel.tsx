'use client'

import { useEffect, useState } from 'react'
import { Crown, Loader2, Trash2, UserPlus } from 'lucide-react'
import type { AdminRow } from '@/app/api/admin/admins/route'

/** Admin list; the owner (ADMIN_PHONE) can add / remove admins by phone number. */
export function AdminsPanel({ isOwner }: { isOwner: boolean }) {
  const [admins, setAdmins] = useState<AdminRow[] | null>(null)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [migration, setMigration] = useState(false)

  function load() {
    fetch('/api/admin/admins')
      .then((r) => r.json())
      .then((d) => {
        setAdmins(d.admins ?? [])
        setMigration(!!d.migrationNeeded)
      })
      .catch(() => setAdmins([]))
  }
  useEffect(load, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(phone.includes('@') ? { email: phone } : { phone }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (!res?.ok) {
      setMsg({ ok: false, text: d.error ?? 'Xatolik.' })
      return
    }
    setMsg({ ok: true, text: d.preregistered ? `${d.name} admin qilindi — u Google orqali kirganda avtomatik admin bo'ladi.` : `${d.name} admin qilindi.` })
    setPhone('')
    load()
  }

  async function remove(a: AdminRow) {
    if (!confirm(`${a.name} adminlikdan olinsinmi?`)) return
    await fetch(`/api/admin/admins?id=${a.id}`, { method: 'DELETE' }).catch(() => {})
    load()
  }

  return (
    <div>
      {migration && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
          Bazada &quot;role&quot; ustuni yo&apos;q — supabase/schema.sql oxiridagi v38 qismini ishga tushiring.
        </div>
      )}

      {isOwner ? (
        <form onSubmit={add} className="mb-5 flex flex-wrap gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Yangi admin: Google akkaunt emaili yoki telefon raqami"
            className="min-w-[240px] flex-1 rounded-[9px] border border-line px-3 py-2.5 text-[13.5px] focus:border-green focus:outline-none"
          />
          <button
            type="submit"
            disabled={!phone.trim() || busy}
            className="flex items-center gap-1.5 rounded-[9px] bg-ink px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Admin qo&apos;shish
          </button>
        </form>
      ) : (
        <p className="mb-4 text-[12.5px] text-ink-faint">Adminlarni faqat asosiy egasi qo&apos;sha oladi.</p>
      )}
      {msg && (
        <div className={`mb-3 text-[12.5px] font-semibold ${msg.ok ? 'text-green-deep' : 'text-red-600'}`}>{msg.text}</div>
      )}

      {admins === null ? (
        <Loader2 size={15} className="animate-spin text-ink-faint" />
      ) : (
        <div className="divide-y divide-line rounded-xl border border-line bg-white">
          {admins.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
                  {a.name}
                  {a.owner && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-extrabold text-amber-800">
                      <Crown size={10} /> EGASI
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-ink-faint">{[a.email, a.phone].filter(Boolean).join(' · ')}</div>
              </div>
              {isOwner && !a.owner && (
                <button
                  type="button"
                  onClick={() => remove(a)}
                  className="rounded-lg p-2 text-ink-faint hover:bg-red-50 hover:text-red-600"
                  aria-label="Adminlikdan olish"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          {admins.length === 0 && <div className="px-4 py-3 text-[12.5px] text-ink-faint">Hali admin yo&apos;q.</div>}
        </div>
      )}
      <p className="mt-3 text-[11.5px] text-ink-faint">
        Yangi admin ham panelga kirishda admin kodini teradi (ADMIN_ACCESS_CODE).
      </p>
    </div>
  )
}
