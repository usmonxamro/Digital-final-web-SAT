'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarClock, ChevronDown, Loader2, MonitorPlay, Search, Trash2, Users } from 'lucide-react'
import type { MockTestSummary } from '@/app/api/tests/route'
import type { MockAttemptRow, MockStat } from '@/app/api/admin/mock-stats/route'
import { PublishActions } from '@/components/admin/publish-actions'
import { groupBySlug, groupsOfTask } from '@/lib/course-groups'

type Filter = 'all' | 'published' | 'draft'

/** Admin "Mocklar": every mock with draft state, solve statistics, results and video analysis. */
export function MocksPanel() {
  const [tests, setTests] = useState<MockTestSummary[] | null>(null)
  const [stats, setStats] = useState<Record<string, MockStat>>({})
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  function load() {
    fetch('/api/tests?all=1')
      .then((r) => r.json())
      .then((d) => setTests(d.tests ?? []))
      .catch(() => setTests([]))
    fetch('/api/admin/mock-stats')
      .then((r) => r.json())
      .then((d) => setStats(Object.fromEntries(((d.stats ?? []) as MockStat[]).map((s) => [s.label, s]))))
      .catch(() => {})
  }
  useEffect(load, [])

  const counts = useMemo(
    () => ({
      all: tests?.length ?? 0,
      published: tests?.filter((t) => t.published).length ?? 0,
      draft: tests?.filter((t) => !t.published).length ?? 0,
    }),
    [tests],
  )
  const shown = (tests ?? []).filter(
    (t) =>
      (filter === 'all' || (filter === 'draft' ? !t.published : t.published)) &&
      t.label.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'Hammasi'],
            ['published', 'Publish qilingan'],
            ['draft', 'Draft'],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors ${
              filter === f ? 'border-ink bg-ink text-white' : 'border-line text-ink-soft hover:border-green'
            }`}
          >
            {label} <span className="opacity-60">{counts[f]}</span>
          </button>
        ))}
        <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-[260px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Qidirish..."
            className="w-full rounded-lg border border-line py-1.5 pl-8 pr-3 text-[12.5px] focus:border-green focus:outline-none"
          />
        </div>
      </div>

      {tests === null ? (
        <div className="flex items-center gap-2 py-4 text-[13px] text-ink-faint">
          <Loader2 size={14} className="animate-spin" /> Yuklanmoqda...
        </div>
      ) : shown.length === 0 ? (
        <p className="text-[13px] text-ink-faint">Mock topilmadi.</p>
      ) : (
        <div className="space-y-2.5">
          {shown.map((t) => {
            const s = stats[t.label]
            const isOpen = open === t.label
            return (
              <div key={t.label} className="overflow-hidden rounded-xl border border-line bg-white">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : t.label)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left hover:bg-bg-deep/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-bold text-ink">
                      {t.label}
                      {!t.published && (
                        <span className="rounded-full bg-amber-400 px-1.5 py-px text-[9.5px] font-extrabold text-amber-950">DRAFT</span>
                      )}
                      {!t.published && t.publishAt && (
                        <span className="flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-px text-[9.5px] font-extrabold text-violet-800">
                          <CalendarClock size={10} />
                          {new Date(t.publishAt).toLocaleString('uz-UZ', {
                            timeZone: 'Asia/Tashkent',
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                      {t.section === 'free' && (
                        <span className="rounded-full bg-orange-500 px-1.5 py-px text-[9.5px] font-extrabold text-white">FREE MOCK</span>
                      )}
                      {t.access === 'paid' && (
                        <span className="rounded-full bg-amber-300 px-1.5 py-px text-[9.5px] font-extrabold text-amber-950">🔒 PULLIK</span>
                      )}
                      {t.placement === 'course_task' && (
                        <span className="rounded-full bg-sky-100 px-1.5 py-px text-[9.5px] font-extrabold text-sky-800">
                          VAZIFA{t.recommendedMinutes ? ` · ${t.recommendedMinutes} daq` : ''}
                        </span>
                      )}
                      {groupsOfTask(t.label, t.courseGroups)
                        .filter((slug) => t.placement === 'course_task' || t.courseGroups.includes(slug))
                        .map((slug) => (
                          <span key={slug} className="rounded-full bg-indigo-100 px-1.5 py-px text-[9.5px] font-extrabold text-indigo-800">
                            GURUH · {(groupBySlug(slug)?.short ?? slug).toUpperCase()}
                          </span>
                        ))}
                      {t.hasVideo && (
                        <span className="flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-px text-[9.5px] font-extrabold text-orange-800">
                          <MonitorPlay size={10} /> VIDEO
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-ink-faint">
                      {t.subject === 'full' ? 'Full' : t.subject === 'math' ? 'Math' : 'English'} · R&W {t.readingCount} · Math{' '}
                      {t.mathCount}
                    </div>
                  </div>
                  <Stat icon={<BarChart3 size={13} />} label="yechilgan" value={s?.attempts ?? 0} />
                  <Stat icon={<Users size={13} />} label="o'quvchi" value={s?.users ?? 0} />
                  <Stat label="o'rtacha" value={s?.avgScore ?? '—'} />
                  <Stat label="eng yuqori" value={s?.bestScore ?? '—'} />
                  <ChevronDown size={16} className={`text-ink-faint transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="space-y-4 border-t border-line bg-bg-deep/30 px-4 py-4">
                    <PublishActions testLabel={t.label} onChange={load} />
                    <VideoField testLabel={t.label} onSaved={load} />
                    <AttemptsTable label={t.label} />
                    <DeleteMock
                      testLabel={t.label}
                      attempts={s?.attempts ?? 0}
                      onDeleted={() => {
                        setOpen(null)
                        load()
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DeleteMock({ testLabel, attempts, onDeleted }: { testLabel: string; attempts: number; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [withResults, setWithResults] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/admin/tests', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testLabel, deleteResults: withResults }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (!res?.ok) {
      setError(d.error ?? 'Xatolik yuz berdi.')
      return
    }
    onDeleted()
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-[12.5px] font-bold text-red-600 hover:bg-red-50"
      >
        <Trash2 size={14} /> Mockni o&apos;chirish
      </button>
    )
  }
  return (
    <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-[12.5px]">
      <p className="font-bold text-red-700">
        &quot;{testLabel}&quot; va uning barcha savollari butunlay o&apos;chiriladi. Bu amalni qaytarib bo&apos;lmaydi.
      </p>
      {attempts > 0 && (
        <label className="mt-2 flex items-center gap-2 text-ink-soft">
          <input type="checkbox" checked={withResults} onChange={(e) => setWithResults(e.target.checked)} />
          O&apos;quvchilarning {attempts} ta natijasini ham o&apos;chirish
        </label>
      )}
      <p className="mt-2 text-ink-soft">Tasdiqlash uchun mock nomini yozing:</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={testLabel}
          className="min-w-[200px] flex-1 rounded-lg border border-line bg-white px-3 py-2 focus:border-red-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={remove}
          disabled={typed.trim() !== testLabel || busy}
          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 font-bold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} O&apos;chirish
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false)
            setTyped('')
          }}
          className="rounded-lg border border-line bg-white px-3 py-2 font-semibold text-ink-soft"
        >
          Bekor
        </button>
      </div>
      {error && <div className="mt-1.5 font-semibold text-red-600">{error}</div>}
    </div>
  )
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="min-w-[64px] text-right">
      <div className="flex items-center justify-end gap-1 text-[15px] font-black tabular-nums text-ink">
        {icon && <span className="text-ink-faint">{icon}</span>}
        {value}
      </div>
      <div className="text-[10.5px] font-semibold text-ink-faint">{label}</div>
    </div>
  )
}

function VideoField({ testLabel, onSaved }: { testLabel: string; onSaved: () => void }) {
  const [current, setCurrent] = useState<string | null | undefined>(undefined)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch(`/api/admin/test-video?testLabel=${encodeURIComponent(testLabel)}`)
      .then((r) => r.json())
      .then((d) => setCurrent(d.videoId ?? null))
      .catch(() => setCurrent(null))
  }, [testLabel])

  async function save(value: string) {
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/admin/test-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testLabel, url: value }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (!res?.ok) {
      setMsg({ ok: false, text: d.error ?? 'Xatolik.' })
      return
    }
    setCurrent(d.videoId ?? null)
    setUrl('')
    setMsg({ ok: true, text: d.videoId ? 'Video tahlil biriktirildi.' : "Video olib tashlandi." })
    onSaved()
  }

  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
        <MonitorPlay size={14} className="text-orange-600" /> Video tahlil (YouTube)
      </div>
      {current === undefined ? (
        <Loader2 size={14} className="animate-spin text-ink-faint" />
      ) : (
        <>
          {current && (
            <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-soft">
              <span className="font-semibold text-green-deep">Biriktirilgan</span>
              <a
                href={`/dashboard/analysis?test=${encodeURIComponent(testLabel)}`}
                target="_blank"
                rel="noopener"
                className="font-semibold underline"
              >
                Ko&apos;rish
              </a>
              <button
                type="button"
                onClick={() => save('')}
                disabled={busy}
                className="ml-auto flex items-center gap-1 rounded px-1.5 py-1 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={13} /> Olib tashlash
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={current ? 'Boshqa video havolasi bilan almashtirish' : 'https://youtu.be/... (unlisted yoki public)'}
              className="min-w-[220px] flex-1 rounded-lg border border-line px-3 py-2 text-[12.5px] focus:border-green focus:outline-none"
            />
            <button
              type="button"
              onClick={() => save(url)}
              disabled={!url.trim() || busy}
              className="rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : 'Saqlash'}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            O&apos;quvchilar videoni faqat shu mockni yechgandan keyin, saytning o&apos;z pleyerida ko&apos;radi — YouTube havolasi
            ko&apos;rsatilmaydi. Videoni YouTube&apos;da &quot;Unlisted&quot; qilib qo&apos;ying.
          </p>
        </>
      )}
      {msg && <div className={`mt-1.5 text-[12px] font-semibold ${msg.ok ? 'text-green-deep' : 'text-red-600'}`}>{msg.text}</div>}
    </div>
  )
}

function AttemptsTable({ label }: { label: string }) {
  const [rows, setRows] = useState<MockAttemptRow[] | null>(null)

  useEffect(() => {
    fetch(`/api/admin/mock-stats?label=${encodeURIComponent(label)}`)
      .then((r) => r.json())
      .then((d) => setRows(d.attempts ?? []))
      .catch(() => setRows([]))
  }, [label])

  if (rows === null) return <Loader2 size={14} className="animate-spin text-ink-faint" />
  if (rows.length === 0) return <p className="text-[12.5px] text-ink-faint">Bu mockni hali hech kim yechmagan.</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full min-w-[620px] text-[12.5px]">
        <thead>
          <tr className="bg-bg-deep/60 text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            <th className="px-3 py-2">O&apos;quvchi</th>
            <th className="px-3 py-2 text-right">Ball</th>
            <th className="px-3 py-2 text-right">R&W</th>
            <th className="px-3 py-2 text-right">Math</th>
            <th className="px-3 py-2 text-right">To&apos;g&apos;ri / xato / bo&apos;sh</th>
            <th className="px-3 py-2 text-right">Vaqt</th>
            <th className="px-3 py-2 text-right">Sana</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="px-3 py-2">
                <div className="font-semibold text-ink">{r.name}</div>
                <div className="text-[11px] text-ink-faint">{r.phone}</div>
              </td>
              <td className="px-3 py-2 text-right text-[14px] font-black tabular-nums text-ink">{r.composite}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.subject === 'math' ? '—' : r.rw}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.subject === 'english' ? '—' : r.math}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span className="text-green-700">{r.correct}</span> / <span className="text-red-600">{r.incorrect}</span> /{' '}
                <span className="text-ink-faint">{r.omitted}</span>
              </td>
              <td className="px-3 py-2 text-right text-ink-soft">{r.elapsed ?? '—'}</td>
              <td className="px-3 py-2 text-right text-ink-soft">
                {new Date(r.createdAt).toLocaleString('uz-UZ', {
                  timeZone: 'Asia/Tashkent',
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
