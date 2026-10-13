'use client'

import { COURSE_GROUPS } from '@/lib/course-groups'
import { useEffect, useState } from 'react'
import { Loader2, Search, ShieldCheck, UserPlus } from 'lucide-react'
import type { UserRow } from '@/app/api/admin/users/route'

/** Admin "Foydalanuvchilar": everyone who registered (password or Google). */
export function UsersPanel({ isOwner }: { isOwner: boolean }) {
  const [rows, setRows] = useState<UserRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function load(p = page, q = applied) {
    setRows(null)
    fetch(`/api/admin/users?page=${p}&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error)
          setRows([])
          return
        }
        setError(null)
        setRows(d.users ?? [])
        setTotal(d.total ?? 0)
        setPageSize(d.pageSize ?? 25)
      })
      .catch(() => {
        setError("Ro'yxatni yuklab bo'lmadi.")
        setRows([])
      })
  }
  useEffect(() => load(page, applied), [page, applied]) // eslint-disable-line react-hooks/exhaustive-deps

  async function makeAdmin(u: UserRow) {
    if (!confirm(`${u.name || u.email} admin qilinsinmi?`)) return
    setBusyId(u.id)
    await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id }),
    }).catch(() => {})
    setBusyId(null)
    load()
  }

  async function toggleCourse(u: UserRow) {
    setBusyId(u.id)
    const r = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, courseMember: !u.courseMember }),
    }).catch(() => null)
    if (r && !r.ok) {
      const d = await r.json().catch(() => ({}))
      setError(d.error ?? 'Saqlab bo‘lmadi.')
    }
    setBusyId(null)
    load()
  }

  async function toggleGroup(u: UserRow, slug: string) {
    setBusyId(u.id)
    const r = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id, group: slug, groupOn: !u.courseGroups.includes(slug) }),
    }).catch(() => null)
    if (r && !r.ok) {
      const d = await r.json().catch(() => ({}))
      setError(d.error ?? 'Saqlab bo‘lmadi.')
    }
    setBusyId(null)
    load()
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setPage(0)
          setApplied(query.trim())
        }}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism, email yoki telefon..."
            className="w-full rounded-lg border border-line py-2 pl-8 pr-3 text-[12.5px] focus:border-green focus:outline-none"
          />
        </div>
        <button type="submit" className="rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-bold text-white">
          Qidirish
        </button>
        <span className="ml-auto text-[12px] font-semibold text-ink-faint">Jami: {total} ta foydalanuvchi</span>
      </form>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">{error}</div>}

      {rows === null ? (
        <div className="flex items-center gap-2 py-4 text-[13px] text-ink-faint">
          <Loader2 size={14} className="animate-spin" /> Yuklanmoqda...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[780px] text-[12.5px]">
            <thead>
              <tr className="bg-bg-deep/60 text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2">Foydalanuvchi</th>
                <th className="px-3 py-2">Kirish usuli</th>
                <th className="px-3 py-2">Tarif</th>
                <th className="px-3 py-2">Kurs</th>
                <th className="px-3 py-2 text-right">Mocklar</th>
                <th className="px-3 py-2 text-right">Ro&apos;yxatdan o&apos;tgan</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 font-semibold text-ink">
                      {u.name || '—'}
                      {u.role === 'admin' && (
                        <span className="flex items-center gap-0.5 rounded-full bg-green-mist px-1.5 py-px text-[9.5px] font-extrabold text-green-deep">
                          <ShieldCheck size={10} /> ADMIN
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-faint">{[u.email, u.phone].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{u.google ? 'Google' : u.email ? 'Email + parol' : 'Telefon + parol'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                        u.plan === 'premium' ? 'bg-amber-100 text-amber-800' : 'bg-bg-deep text-ink-faint'
                      }`}
                    >
                      {u.plan === 'premium' ? 'PRO' : 'FREE'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleCourse(u)}
                      disabled={busyId === u.id}
                      title="Telegram kurs guruhi a'zosi — My Courses vazifalarini ochadi"
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                        u.courseMember ? 'bg-green-mist text-green-deep' : 'bg-bg-deep text-ink-faint hover:text-ink'
                      }`}
                    >
                      {u.courseMember ? "HAMMASI ✓" : "hammasi emas"}
                    </button>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {COURSE_GROUPS.map((g) => {
                        const on = u.courseGroups.includes(g.slug)
                        return (
                          <button
                            key={g.slug}
                            type="button"
                            onClick={() => toggleGroup(u, g.slug)}
                            disabled={busyId === u.id}
                            title={`${g.title} — ${on ? 'olib tashlash' : "qo'shish"}`}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              on ? 'bg-green-mist text-green-deep' : 'bg-bg-deep text-ink-faint hover:text-ink'
                            }`}
                          >
                            {g.slug}
                            {on ? ' ✓' : ''}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.attempts}</td>
                  <td className="px-3 py-2 text-right text-ink-soft">
                    {new Date(u.createdAt).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isOwner && u.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => makeAdmin(u)}
                        disabled={busyId === u.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11.5px] font-bold text-ink-soft hover:border-green"
                      >
                        <UserPlus size={12} /> Admin qilish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-ink-faint">
                    Foydalanuvchi topilmadi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-[12px] font-semibold text-ink-soft">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">
            ← Oldingi
          </button>
          <span>
            {page + 1} / {pages}
          </span>
          <button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">
            Keyingi →
          </button>
        </div>
      )}
    </div>
  )
}
