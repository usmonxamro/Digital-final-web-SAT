'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2, Loader2, Plus, Search, Users, X } from 'lucide-react'
import type { MockTestSummary } from '@/app/api/tests/route'
import type { GroupStats } from '@/app/api/admin/groups/route'
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

  function loadTests() {
    fetch('/api/tests?all=1')
      .then((r) => r.json())
      .then((d) => setTests(d.tests ?? []))
      .catch(() => setTests([]))
  }
  useEffect(loadTests, [])

  useEffect(() => {
    setStats(null)
    fetch(`/api/admin/groups?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => setStats(d.error ? { members: 0, done: {} } : d))
      .catch(() => setStats({ members: 0, done: {} }))
  }, [slug])

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

      {tests === null ? (
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
