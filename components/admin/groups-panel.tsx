'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2, Copy, KeyRound, Loader2, Plus, RefreshCw, Search, Trash2, Users, X } from 'lucide-react'
import type { MockTestSummary } from '@/app/api/tests/route'
import type { GroupStats } from '@/app/api/admin/groups/route'
import type { GroupMember } from '@/app/api/admin/groups/members/route'
import { COURSE_GROUPS, groupsOfTask } from '@/lib/course-groups'

/**
 * Admin "Guruhlar": pick a group (Noyabr / Dekabr) and see what it has been given, how many of its
 * students finished each item, and what could still be given. Giving / taking back is one click;
 * a mock can sit in several groups at once and stays in All Past Exams / Free Mocks as before.
 */
export function GroupsPanel() {
  const [slug, setSlug] = useState(COURSE_GROUPS[0].slug)
  const [tests, setTests] = useState<MockTestSummary[] | null>(null)
  const [stats, setStats] = useState<GroupStats | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'tasks' | 'students'>('tasks')
  const [codes, setCodes] = useState<Record<string, { code: string; active: boolean }> | null>(null)

  useEffect(() => {
    fetch('/api/admin/groups/code')
      .then((r) => r.json())
      .then((d) => (d.codes ? setCodes(d.codes) : setError(d.error ?? 'Kodlarni yuklab bo‘lmadi.')))
      .catch(() => setError("Server bilan bog'lanib bo'lmadi."))
  }, [])

  async function codeAction(action: 'regenerate' | 'on' | 'off') {
    if (action === 'regenerate' && !window.confirm(`${group.title} uchun YANGI kod yaratilsinmi? Eski kod endi ishlamaydi (qo'shilib bo'lgan o'quvchilar guruhda qoladi).`)) return
    setError(null)
    const res = await fetch('/api/admin/groups/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, action }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return setError(d.error ?? 'Saqlab bo‘lmadi.')
    setCodes((c) => ({ ...(c ?? {}), [slug]: { code: d.code ?? c?.[slug]?.code ?? '', active: d.active } }))
  }

  function loadTests() {
    fetch('/api/tests?all=1')
      .then((r) => r.json())
      .then((d) => setTests(d.tests ?? []))
      .catch(() => setTests([]))
  }
  useEffect(loadTests, [])

  function loadStats() {
    setStats(null)
    fetch(`/api/admin/groups?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => setStats(d.error ? { members: 0, done: {} } : d))
      .catch(() => setStats({ members: 0, done: {} }))
  }
  useEffect(loadStats, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const group = COURSE_GROUPS.find((g) => g.slug === slug)!

  /** Same rule the students' My Courses uses. */
  const inGroup = (t: MockTestSummary, s: string) =>
    groupsOfTask(t.label, t.courseGroups).includes(s) && (t.placement === 'course_task' || t.courseGroups.includes(s))

  const given = useMemo(() => (tests ?? []).filter((t) => inGroup(t, slug)), [tests, slug]) // eslint-disable-line react-hooks/exhaustive-deps
  const notGiven = useMemo(
    () =>
      (tests ?? []).filter(
        (t) => !inGroup(t, slug) && t.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [tests, slug, query], // eslint-disable-line react-hooks/exhaustive-deps
  )

  async function setGiven(t: MockTestSummary, on: boolean) {
    setBusy(t.label)
    setError(null)
    const next = on ? [...new Set([...t.courseGroups, slug])] : t.courseGroups.filter((g) => g !== slug)
    // optimistic
    setTests((cur) => (cur ?? []).map((x) => (x.label === t.label ? { ...x, courseGroups: next } : x)))
    try {
      const res = await fetch('/api/admin/test-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testLabel: t.label, courseGroups: next }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error ?? 'Saqlab bo‘lmadi.')
        loadTests()
      }
    } catch {
      setError("Server bilan bog'lanib bo'lmadi.")
      loadTests()
    } finally {
      setBusy(null)
    }
  }

  const countOf = (t: MockTestSummary) => (t.subject === 'full' ? t.readingCount + t.mathCount : t.subject === 'math' ? t.mathCount : t.readingCount)

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {COURSE_GROUPS.map((g) => {
          const n = (tests ?? []).filter((t) => inGroup(t, g.slug)).length
          return (
            <button
              key={g.slug}
              type="button"
              onClick={() => setSlug(g.slug)}
              className={`rounded-lg border px-3.5 py-2 text-[13px] font-bold transition-colors ${
                slug === g.slug ? 'border-ink bg-ink text-white' : 'border-line text-ink-soft hover:border-green'
              }`}
            >
              {g.title} <span className="opacity-60">{tests ? n : '…'}</span>
            </button>
          )
        })}
        <span className="ml-auto flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft">
          <Users size={14} /> {stats ? `${stats.members} ta o'quvchi` : '…'}
        </span>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">{error}</div>}

      <JoinCodeCard info={codes?.[slug] ?? null} loading={codes === null && !error} onAction={codeAction} />

      <div className="mb-4 flex gap-1 border-b border-line">
        {(
          [
            ['tasks', 'Vazifalar va mocklar'],
            ['students', "O'quvchilar"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setView(k)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-[13px] font-bold transition-colors ${
              view === k ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {label}
            {k === 'students' && stats ? <span className="ml-1.5 opacity-60">{stats.members}</span> : null}
          </button>
        ))}
      </div>

      {view === 'students' ? (
        <MembersView key={slug} slug={slug} onChanged={loadStats} />
      ) : tests === null ? (
        <div className="flex items-center gap-2 py-4 text-[13px] text-ink-faint">
          <Loader2 size={14} className="animate-spin" /> Yuklanmoqda...
        </div>
      ) : (
        <>
          <h3 className="mb-2 text-[13.5px] font-extrabold text-ink">
            {group.title} — berilgan ({given.length})
          </h3>
          {given.length === 0 ? (
            <p className="mb-5 text-[12.5px] text-ink-faint">Bu guruhga hali hech narsa berilmagan. Pastdagi ro&apos;yxatdan tanlang.</p>
          ) : (
            <div className="mb-6 space-y-2">
              {given.map((t) => {
                const done = stats?.done[t.label] ?? 0
                const byName = !t.courseGroups.includes(slug) // legacy: the name starts with the group title
                return (
                  <div key={t.label} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-line px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-bold text-ink">
                        {t.label}
                        <Badges t={t} />
                      </div>
                      <div className="text-[11.5px] text-ink-faint">
                        {countOf(t)} ta savol
                        {t.placement === 'course_task' && t.recommendedMinutes ? ` · tavsiya ${t.recommendedMinutes} daq` : ''}
                        {byName ? ' · nomi bo‘yicha (eski)' : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 text-[14px] font-black tabular-nums text-ink">
                        {stats && stats.members > 0 && done >= stats.members && <CheckCircle2 size={14} className="text-green" />}
                        {stats ? `${done} / ${stats.members}` : '…'}
                      </div>
                      <div className="text-[10.5px] font-semibold text-ink-faint">yechgan</div>
                    </div>
                    {!byName && (
                      <button
                        type="button"
                        onClick={() => setGiven(t, false)}
                        disabled={busy === t.label}
                        title="Bu guruhdan olib tashlash (boshqa guruhlarda va oddiy ro'yxatlarda qoladi)"
                        className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-bold text-ink-soft hover:border-red-300 hover:text-red-600"
                      >
                        {busy === t.label ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Olib tashlash
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-[13.5px] font-extrabold text-ink">Berilmagan — berishingiz mumkin ({notGiven.length})</h3>
            <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-[240px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Qidirish..."
                className="w-full rounded-lg border border-line py-1.5 pl-8 pr-3 text-[12.5px] focus:border-green focus:outline-none"
              />
            </div>
          </div>
          {notGiven.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">Berilmagan mock yoki vazifa yo&apos;q.</p>
          ) : (
            <div className="space-y-2">
              {notGiven.map((t) => (
                <div key={t.label} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold text-ink">
                      {t.label}
                      <Badges t={t} />
                    </div>
                    <div className="text-[11.5px] text-ink-faint">
                      {countOf(t)} ta savol
                      {t.courseGroups.length > 0 &&
                        ` · boshqa guruh: ${t.courseGroups.map((g) => COURSE_GROUPS.find((c) => c.slug === g)?.short ?? g).join(', ')}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGiven(t, true)}
                    disabled={busy === t.label}
                    className="flex items-center gap-1 rounded-lg border border-green bg-green-mist px-3 py-1.5 text-[12px] font-bold text-green-deep hover:bg-white"
                  >
                    {busy === t.label ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {group.short} guruhiga berish
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 flex items-start gap-1.5 text-[11.5px] text-ink-faint">
            <Check size={12} className="mt-0.5 shrink-0" />
            Bitta mockni bir nechta guruhga bera olasiz. Oddiy mock guruhga berilgach ham All Past Exams / Free Mocks ro&apos;yxatida qoladi
            (uning bo&apos;limi va bepul/pullik holati o&apos;sha mockning o&apos;z sozlamasida). Vazifa esa faqat guruh o&apos;quvchilariga ochiq.
          </p>
        </>
      )}
    </div>
  )
}

function Badges({ t }: { t: MockTestSummary }) {
  return (
    <>
      {t.placement === 'course_task' ? (
        <span className="rounded-full bg-sky-100 px-1.5 py-px text-[9.5px] font-extrabold text-sky-800">VAZIFA</span>
      ) : (
        <span className="rounded-full bg-violet-100 px-1.5 py-px text-[9.5px] font-extrabold text-violet-800">MOCK</span>
      )}
      {t.placement === 'mock' && t.section === 'free' && (
        <span className="rounded-full bg-orange-500 px-1.5 py-px text-[9.5px] font-extrabold text-white">FREE MOCK</span>
      )}
      {!t.published && <span className="rounded-full bg-amber-400 px-1.5 py-px text-[9.5px] font-extrabold text-amber-950">DRAFT</span>}
    </>
  )
}

function JoinCodeCard({
  info,
  loading,
  onAction,
}: {
  info: { code: string; active: boolean } | null
  loading: boolean
  onAction: (a: 'regenerate' | 'on' | 'off') => void
}) {
  const [copied, setCopied] = useState(false)
  function copy() {
    if (!info) return
    navigator.clipboard?.writeText(info.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-green-mist/40 px-4 py-3">
      <KeyRound size={18} className="shrink-0 text-green-deep" />
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-semibold text-ink-soft">Guruh kodi — shu kodni Telegram guruhga yuboring</div>
        {loading || !info ? (
          <div className="py-1 text-[13px] text-ink-faint">{loading ? 'Yuklanmoqda...' : 'Kod yo‘q'}</div>
        ) : (
          <div className={`font-mono text-[20px] font-black tracking-wider ${info.active ? 'text-ink' : 'text-ink-faint line-through'}`}>{info.code}</div>
        )}
        <div className="text-[11.5px] text-ink-faint">
          O&apos;quvchi kodni bir marta kiritadi (Kurslar → Kod bilan qo&apos;shilish) — keyin guruh o&apos;z akkauntida doim ochiq.
          {info && !info.active && ' Hozir O‘CHIRILGAN: yangi o‘quvchilar qo‘shila olmaydi.'}
        </div>
      </div>
      {info && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={copy} className="flex items-center gap-1 rounded-lg border border-green bg-white px-3 py-1.5 text-[12px] font-bold text-green-deep hover:bg-green-mist">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Nusxalandi' : 'Nusxalash'}
          </button>
          <button type="button" onClick={() => onAction(info.active ? 'off' : 'on')} className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:border-green">
            {info.active ? "O'chirib qo'yish" : 'Yoqish'}
          </button>
          <button type="button" onClick={() => onAction('regenerate')} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:border-red-300 hover:text-red-600">
            <RefreshCw size={12} /> Yangi kod
          </button>
        </div>
      )}
    </div>
  )
}

const VIA: Record<GroupMember['via'], { label: string; cls: string }> = {
  code: { label: 'Guruh kodi', cls: 'bg-green-mist text-green-deep' },
  telegram: { label: 'Telegram kodi', cls: 'bg-sky-100 text-sky-800' },
  admin: { label: "Admin qo'shgan", cls: 'bg-violet-100 text-violet-800' },
}

function MembersView({ slug, onChanged }: { slug: string; onChanged: () => void }) {
  const [members, setMembers] = useState<GroupMember[] | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    fetch(`/api/admin/groups/members?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        setMembers(d.members ?? [])
      })
      .catch(() => {
        setError("Server bilan bog'lanib bo'lmadi.")
        setMembers([])
      })
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(m: GroupMember) {
    if (!window.confirm(`${m.name} guruhdan chiqarilsinmi? U kodni qayta kiritib qo'shilishi mumkin.`)) return
    setBusy(m.userId)
    setError(null)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: m.userId, group: slug, groupOn: false }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) return setError(d.error ?? 'Olib tashlab bo‘lmadi.')
    setMembers((cur) => (cur ?? []).filter((x) => x.userId !== m.userId))
    onChanged()
  }

  const q = query.trim().toLowerCase()
  const shown = (members ?? []).filter((m) => !q || `${m.name} ${m.phone} ${m.email}`.toLowerCase().includes(q))
  const fmt = (iso: string) => (iso ? new Date(iso).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

  if (members === null)
    return (
      <div className="flex items-center gap-2 py-4 text-[13px] text-ink-faint">
        <Loader2 size={14} className="animate-spin" /> Yuklanmoqda...
      </div>
    )

  return (
    <>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">{error}</div>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[13.5px] font-extrabold text-ink">Guruh o&apos;quvchilari ({members.length})</h3>
        <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ism, telefon yoki email..."
            className="w-full rounded-lg border border-line py-1.5 pl-8 pr-3 text-[12.5px] focus:border-green focus:outline-none"
          />
        </div>
      </div>
      {members.length === 0 ? (
        <p className="text-[12.5px] text-ink-faint">Bu guruhga hali hech kim qo&apos;shilmagan. Yuqoridagi kodni guruhga yuboring.</p>
      ) : shown.length === 0 ? (
        <p className="text-[12.5px] text-ink-faint">Hech narsa topilmadi.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead className="bg-gray-50 text-[11px] font-extrabold uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">O&apos;quvchi</th>
                <th className="px-3 py-2">Aloqa</th>
                <th className="px-3 py-2">Qo&apos;shilgan</th>
                <th className="px-3 py-2">Qanday</th>
                <th className="px-3 py-2 text-right">Yechgan</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((m, i) => (
                <tr key={m.userId} className="border-t border-line">
                  <td className="px-3 py-2 tabular-nums text-ink-faint">{i + 1}</td>
                  <td className="px-3 py-2 font-bold text-ink">{m.name}</td>
                  <td className="px-3 py-2 text-ink-soft">{m.phone || m.email || '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-ink-soft">{fmt(m.joinedAt)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${VIA[m.via].cls}`}>{VIA[m.via].label}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-black tabular-nums text-ink">{m.done}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(m)}
                      disabled={busy === m.userId}
                      title="Guruhdan chiqarish"
                      className="rounded-lg border border-line p-1.5 text-ink-soft hover:border-red-300 hover:text-red-600"
                    >
                      {busy === m.userId ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
