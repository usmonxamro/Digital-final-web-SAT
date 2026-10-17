'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarClock,
  Check,
  ChevronDown,
  FolderPlus,
  GripVertical,
  Loader2,
  Lock,
  MonitorPlay,
  Pencil,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import type { MockTestSummary } from '@/app/api/tests/route'
import type { MockAttemptRow, MockStat } from '@/app/api/admin/mock-stats/route'
import type { MockFolder } from '@/app/api/admin/folders/route'
import { PublishActions } from '@/components/admin/publish-actions'
import { groupBySlug, groupsOfTask } from '@/lib/course-groups'

type Filter = 'all' | 'published' | 'draft'
/** 'all' | 'exams' | 'free' | 'paid' | a folder id */
type Tab = string

const SYSTEM_TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'all', label: 'Hammasi', hint: 'Barcha mocklar' },
  { key: 'exams', label: 'All Past Exams', hint: 'Mockni shu yerga tashlasangiz All Past Exams bo‘limiga o‘tadi' },
  { key: 'free', label: 'Free Mocks', hint: 'Mockni shu yerga tashlasangiz Free Mocks bo‘limiga o‘tadi' },
  { key: 'paid', label: 'Pullik', hint: 'Mockni shu yerga tashlasangiz pullik bo‘ladi' },
]

/**
 * Admin "Mocklar": every mock with draft state, solve statistics, results and video analysis.
 * Bo'limlar: All Past Exams / Free Mocks / Pullik and your own folders. A mock always stays in
 * "Hammasi"; drag it onto a bo'lim, or use the buttons to the right of its name.
 */
export function MocksPanel() {
  const [tests, setTests] = useState<MockTestSummary[] | null>(null)
  const [stats, setStats] = useState<Record<string, MockStat>>({})
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const [folders, setFolders] = useState<MockFolder[]>([])
  const [folderHint, setFolderHint] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [dragLabel, setDragLabel] = useState<string | null>(null)
  const [overTab, setOverTab] = useState<Tab | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  function loadFolders() {
    fetch('/api/admin/folders')
      .then((r) => r.json())
      .then((d) => {
        setFolders(d.folders ?? [])
        setFolderHint(d.error ?? null)
      })
      .catch(() => setFolders([]))
  }

  function load() {
    fetch('/api/tests?all=1')
      .then((r) => r.json())
      .then((d) => setTests(d.tests ?? []))
      .catch(() => setTests([]))
    fetch('/api/admin/mock-stats')
      .then((r) => r.json())
      .then((d) => setStats(Object.fromEntries(((d.stats ?? []) as MockStat[]).map((s) => [s.label, s]))))
      .catch(() => {})
    loadFolders()
  }
  useEffect(load, [])

  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 3200)
    return () => clearTimeout(t)
  }, [note])

  const inTab = (t: MockTestSummary, key: Tab) =>
    key === 'all' ? true : key === 'exams' ? t.section === 'exams' : key === 'free' ? t.section === 'free' : key === 'paid' ? t.access === 'paid' : t.folderIds.includes(key)

  const tabCount = (key: Tab) => (tests ?? []).filter((t) => inTab(t, key)).length
  const folderName = (id: string) => folders.find((f) => f.id === id)?.name ?? ''

  /** Change one mock's section / paid flag / folders (optimistic, rolled back on error). */
  async function patchMock(label: string, patch: Partial<Pick<MockTestSummary, 'section' | 'access' | 'folderIds'>>, okText?: string) {
    const prev = (tests ?? []).find((t) => t.label === label)
    if (!prev) return
    setTests((cur) => (cur ?? []).map((t) => (t.label === label ? { ...t, ...patch } : t)))
    try {
      const res = await fetch('/api/admin/test-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testLabel: label, ...patch }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Saqlab bo‘lmadi.')
      if (okText) setNote({ ok: true, text: okText })
    } catch (e) {
      setTests((cur) => (cur ?? []).map((t) => (t.label === label ? prev : t)))
      setNote({ ok: false, text: e instanceof Error ? e.message : "Server bilan bog'lanib bo'lmadi." })
    }
  }

  function toggleFolder(t: MockTestSummary, id: string) {
    const on = t.folderIds.includes(id)
    patchMock(t.label, { folderIds: on ? t.folderIds.filter((x) => x !== id) : [...t.folderIds, id] })
  }

  function dropOn(key: Tab) {
    const label = dragLabel
    setDragLabel(null)
    setOverTab(null)
    const t = (tests ?? []).find((x) => x.label === label)
    if (!t || key === 'all') return
    if (key === 'exams' || key === 'free') {
      const name = key === 'exams' ? 'All Past Exams' : 'Free Mocks'
      if (t.section === key) return setNote({ ok: true, text: `"${t.label}" allaqachon ${name} da.` })
      patchMock(t.label, { section: key }, `"${t.label}" → ${name}`)
    } else if (key === 'paid') {
      if (t.access === 'paid') return setNote({ ok: true, text: `"${t.label}" allaqachon pullik.` })
      patchMock(t.label, { access: 'paid' }, `"${t.label}" → Pullik`)
    } else {
      if (t.folderIds.includes(key)) return setNote({ ok: true, text: `"${t.label}" allaqachon "${folderName(key)}" bo‘limida.` })
      patchMock(t.label, { folderIds: [...t.folderIds, key] }, `"${t.label}" → ${folderName(key)}`)
    }
  }

  async function createFolder() {
    const name = newName.trim()
    if (!name) return
    const res = await fetch('/api/admin/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) return setNote({ ok: false, text: d.error ?? "Server bilan bog'lanib bo'lmadi." })
    setFolders((f) => [...f, d.folder])
    setTab(d.folder.id)
    setNewName('')
    setCreating(false)
    setFolderHint(null)
  }

  async function renameFolder(f: MockFolder) {
    const name = window.prompt('Bo‘lim yangi nomi:', f.name)?.trim()
    if (!name || name === f.name) return
    const res = await fetch('/api/admin/folders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id, name }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) return setNote({ ok: false, text: d.error ?? 'Saqlab bo‘lmadi.' })
    setFolders((cur) => cur.map((x) => (x.id === f.id ? { ...x, name: name.slice(0, 40) } : x)))
  }

  async function deleteFolder(f: MockFolder) {
    if (!window.confirm(`"${f.name}" bo'limi o'chirilsinmi? Mocklar o'chmaydi — umumiy ro'yxatda qoladi.`)) return
    const res = await fetch('/api/admin/folders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) return setNote({ ok: false, text: d.error ?? "O'chirib bo'lmadi." })
    setFolders((cur) => cur.filter((x) => x.id !== f.id))
    setTests((cur) => (cur ?? []).map((t) => ({ ...t, folderIds: t.folderIds.filter((x) => x !== f.id) })))
    if (tab === f.id) setTab('all')
  }

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
      inTab(t, tab) &&
      (filter === 'all' || (filter === 'draft' ? !t.published : t.published)) &&
      t.label.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const tabButton = (key: Tab, label: string, hint: string, opts?: { folder?: MockFolder }) => {
    const active = tab === key
    const droppable = key !== 'all'
    const over = overTab === key && dragLabel !== null
    return (
      <span
        key={key}
        title={hint}
        onDragOver={droppable ? (e) => (e.preventDefault(), setOverTab(key)) : undefined}
        onDragLeave={droppable ? () => setOverTab((o) => (o === key ? null : o)) : undefined}
        onDrop={droppable ? (e) => (e.preventDefault(), dropOn(key)) : undefined}
        className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
          over
            ? 'border-green bg-green-mist text-green-deep ring-2 ring-green/40'
            : active
              ? 'border-ink bg-ink text-white'
              : dragLabel && droppable
                ? 'border-dashed border-green text-ink-soft'
                : 'border-line text-ink-soft hover:border-green'
        }`}
      >
        <button type="button" onClick={() => setTab(key)} className="flex items-center gap-1.5">
          {key === 'paid' && <Lock size={11} />}
          {label} <span className="opacity-60">{tests ? tabCount(key) : '…'}</span>
        </button>
        {opts?.folder && active && (
          <>
            <button type="button" onClick={() => renameFolder(opts.folder!)} title="Nomini o'zgartirish" className="ml-1 opacity-70 hover:opacity-100">
              <Pencil size={11} />
            </button>
            <button type="button" onClick={() => deleteFolder(opts.folder!)} title="Bo'limni o'chirish" className="opacity-70 hover:text-red-300">
              <X size={12} />
            </button>
          </>
        )}
      </span>
    )
  }

  return (
    <div>
      {/* Bo'limlar: system sections + your own folders. Drop a mock onto any of them. */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {SYSTEM_TABS.map((t) => tabButton(t.key, t.label, t.hint))}
        <span className="mx-1 h-5 w-px bg-line" />
        {folders.map((f) => tabButton(f.id, f.name, `Mockni shu yerga tashlasangiz "${f.name}" bo‘limiga qo‘shiladi`, { folder: f }))}
        {creating ? (
          <span className="flex items-center gap-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFolder()
                if (e.key === 'Escape') setCreating(false)
              }}
              maxLength={40}
              autoFocus
              placeholder="Bo'lim nomi"
              className="w-40 rounded-lg border border-green px-2.5 py-1.5 text-[12.5px] focus:outline-none"
            />
            <button type="button" onClick={createFolder} disabled={!newName.trim()} className="rounded-lg bg-ink p-1.5 text-white disabled:opacity-40" title="Yaratish">
              <Check size={14} />
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-line p-1.5 text-ink-soft" title="Bekor">
              <X size={14} />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-green px-3 py-1.5 text-[12.5px] font-bold text-green-deep hover:bg-green-mist"
          >
            <FolderPlus size={13} /> Bo&apos;lim yaratish
          </button>
        )}
      </div>
      {folderHint && <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">{folderHint}</div>}
      {note && (
        <div className={`mb-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold ${note.ok ? 'bg-green-mist text-green-deep' : 'bg-red-50 text-red-700'}`}>{note.text}</div>
      )}

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
        <p className="text-[13px] text-ink-faint">
          {tab === 'all' ? 'Mock topilmadi.' : "Bu bo'limda mock yo'q. Mockni yuqoridagi bo'limga sudrab tashlang yoki mock qatoridagi tugmani bosing."}
        </p>
      ) : (
        <div className="space-y-2.5">
          {shown.map((t) => {
            const s = stats[t.label]
            const isOpen = open === t.label
            const toggle = () => setOpen(isOpen ? null : t.label)
            return (
              <div
                key={t.label}
                className={`overflow-hidden rounded-xl border bg-white transition-opacity ${dragLabel === t.label ? 'border-green opacity-60' : 'border-line'}`}
              >
                {/* Only this header row is draggable, so the inputs below keep normal text selection. */}
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', t.label)
                    e.dataTransfer.effectAllowed = 'copy'
                    setDragLabel(t.label)
                  }}
                  onDragEnd={() => {
                    setDragLabel(null)
                    setOverTab(null)
                  }}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 hover:bg-bg-deep/50"
                >
                  <GripVertical size={16} className="shrink-0 cursor-grab text-ink-faint" aria-label="Sudrab bo'limga qo'shish" />
                  <button type="button" onClick={toggle} className="min-w-0 flex-1 basis-[200px] text-left">
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
                  </button>

                  {/* Bo'limlarga qo'shish: all in one row, to the right of the name */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PlaceBtn active={t.access === 'paid'} tone="amber" onClick={() => patchMock(t.label, { access: t.access === 'paid' ? 'free' : 'paid' })} title="Pullik / bepul">
                      <Lock size={11} /> Pullik
                    </PlaceBtn>
                    <PlaceBtn active={t.section === 'free'} tone="orange" onClick={() => t.section !== 'free' && patchMock(t.label, { section: 'free' })} title="Free Mocks bo'limida ko'rsatish">
                      Free Mock
                    </PlaceBtn>
                    <PlaceBtn active={t.section === 'exams'} tone="blue" onClick={() => t.section !== 'exams' && patchMock(t.label, { section: 'exams' })} title="All Past Exams bo'limida ko'rsatish">
                      All Past Exams
                    </PlaceBtn>
                    {folders.length > 0 && <span className="mx-0.5 h-4 w-px bg-line" />}
                    {folders.map((f) => (
                      <PlaceBtn key={f.id} active={t.folderIds.includes(f.id)} tone="green" onClick={() => toggleFolder(t, f.id)} title={`"${f.name}" bo'limiga qo'shish / olib tashlash`}>
                        {t.folderIds.includes(f.id) && <Check size={11} />} {f.name}
                      </PlaceBtn>
                    ))}
                  </div>

                  <button type="button" onClick={toggle} className="flex items-center gap-4">
                    <Stat icon={<BarChart3 size={13} />} label="yechilgan" value={s?.attempts ?? 0} />
                    <Stat icon={<Users size={13} />} label="o'quvchi" value={s?.users ?? 0} />
                    <Stat label="o'rtacha" value={s?.avgScore ?? '—'} />
                    <Stat label="eng yuqori" value={s?.bestScore ?? '—'} />
                    <ChevronDown size={16} className={`text-ink-faint transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
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

const TONES = {
  amber: 'border-amber-400 bg-amber-300 text-amber-950',
  orange: 'border-orange-500 bg-orange-500 text-white',
  blue: 'border-blue-600 bg-blue-600 text-white',
  green: 'border-green bg-green text-white',
} as const

/** A small on/off pill on a mock's row. */
function PlaceBtn({
  active,
  tone,
  onClick,
  title,
  children,
}: {
  active: boolean
  tone: keyof typeof TONES
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition-colors ${
        active ? TONES[tone] : 'border-line bg-white text-ink-soft hover:border-ink-faint'
      }`}
    >
      {children}
    </button>
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
