'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  CalendarClock,
  Check,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  FileDown,
  FolderPlus,
  Link2,
  GripVertical,
  Minus,
  Plus,
  Loader2,
  Lock,
  MonitorPlay,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import type { MockTestSummary } from '@/app/api/tests/route'
import type { MockAttemptRow, MockStat } from '@/app/api/admin/mock-stats/route'
import type { MockFolder } from '@/app/api/admin/folders/route'
import { PublishActions } from '@/components/admin/publish-actions'
import { DownloadTestPdfButton } from '@/components/test-pdf'
import { loadMockPdfItems } from '@/lib/mock-pdf-items'
import { mockShareUrl } from '@/lib/safe-next'
import { COURSE_GROUPS, groupBySlug, groupsOfTask } from '@/lib/course-groups'
import { inSection, type MockSection } from '@/lib/mock-sections'

type Filter = 'all' | 'published' | 'draft'
/** 'all' | 'exams' | 'free' | 'paid' | a folder id */
type Tab = string

type Sort = 'manual' | 'newest' | 'name' | 'solved' | 'draft'
const SORTS: { key: Sort; label: string }[] = [
  { key: 'manual', label: 'Qo‘lda (o‘zim tartiblayman)' },
  { key: 'newest', label: 'Yangi qo‘shilgan birinchi' },
  { key: 'name', label: 'Nomi A–Z' },
  { key: 'solved', label: 'Ko‘p yechilgan birinchi' },
  { key: 'draft', label: 'Draft birinchi' },
]

const SYSTEM_TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'all', label: 'Hammasi', hint: 'Barcha mocklar' },
  { key: 'exams', label: 'All Past Exams', hint: 'Mockni shu yerga tashlasangiz All Past Exams ga QO‘SHILADI (boshqa bo‘limidan o‘chmaydi)' },
  { key: 'free', label: 'Free Mocks', hint: 'Mockni shu yerga tashlasangiz Free Mocks ga QO‘SHILADI (boshqa bo‘limidan o‘chmaydi)' },
  { key: 'paid', label: 'Pullik', hint: 'Mockni shu yerga tashlasangiz pullik bo‘ladi' },
  { key: 'pdf', label: 'PDF ruxsat', hint: 'Mockni shu yerga tashlasangiz o‘quvchi tugatgach PDF yuklab oladi' },
  { key: 'hidden', label: 'Ko‘rinmaydi', hint: 'Hech qaysi bo‘limda va kurs guruhida yo‘q mocklar' },
]

/** Tab key of a course group. */
const gKey = (slug: string) => `g:${slug}`

type Patch = Partial<Pick<MockTestSummary, 'sections' | 'access' | 'folderIds' | 'pdfDownload' | 'courseGroups' | 'placement'>>
type Lists = { sections?: MockSection[]; folderIds?: string[]; courseGroups?: string[] }
type BulkSet = { access?: 'free' | 'paid'; pdfDownload?: boolean }

const uniq = <T,>(a: T[]) => [...new Set(a)]

/** Same rules as the server's bulk endpoint, applied locally so the list updates at once. */
function applyBulk(t: MockTestSummary, add: Lists, remove: Lists, set: BulkSet): MockTestSummary {
  return {
    ...t,
    sections: add.sections || remove.sections ? uniq([...t.sections.filter((x) => !(remove.sections ?? []).includes(x)), ...(add.sections ?? [])]) : t.sections,
    folderIds: add.folderIds || remove.folderIds ? uniq([...t.folderIds.filter((x) => !(remove.folderIds ?? []).includes(x)), ...(add.folderIds ?? [])]) : t.folderIds,
    courseGroups:
      add.courseGroups || remove.courseGroups ? uniq([...t.courseGroups.filter((x) => !(remove.courseGroups ?? []).includes(x)), ...(add.courseGroups ?? [])]) : t.courseGroups,
    access: set.access ?? t.access,
    pdfDownload: set.pdfDownload ?? t.pdfDownload,
  }
}

/**
 * Admin "Mocklar": every mock with draft state, solve statistics, results and video analysis.
 * Bo'limlar: All Past Exams / Free Mocks / Pullik / PDF / kurs guruhlari and your own folders.
 * A mock can be in SEVERAL bo'lims at once (adding never removes it from another one). Drag a mock
 * onto a bo'lim, use the buttons to the right of its name, or tick many mocks and use the bar on top.
 */
export function MocksPanel({ visible = true }: { visible?: boolean }) {
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sort, setSortState] = useState<Sort>('manual')
  const [overRow, setOverRow] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // The chosen sorting is remembered in this browser (just a convenience).
  useEffect(() => {
    try {
      const v = window.localStorage.getItem('admin-mock-sort')
      if (SORTS.some((x) => x.key === v)) setSortState(v as Sort)
    } catch {
      /* ignore */
    }
  }, [])
  function setSort(v: Sort) {
    setSortState(v)
    try {
      window.localStorage.setItem('admin-mock-sort', v)
    } catch {
      /* ignore */
    }
  }

  function loadFolders() {
    fetch('/api/admin/folders')
      .then((r) => r.json())
      .then((d) => {
        setFolders(d.folders ?? [])
        setFolderHint(d.error ?? null)
      })
      .catch(() => setFolders([]))
  }

  /** The list stays on screen while it refreshes (no flash of "Yuklanmoqda"). `fresh` re-counts the questions. */
  function load(fresh = false) {
    setRefreshing(true)
    fetch(`/api/tests?all=1${fresh ? '&fresh=1' : ''}`)
      .then((r) => r.json())
      .then((d) => setTests(d.tests ?? []))
      .catch(() => setTests((cur) => cur ?? []))
      .finally(() => setRefreshing(false))
    fetch('/api/admin/mock-stats')
      .then((r) => r.json())
      .then((d) => setStats(Object.fromEntries(((d.stats ?? []) as MockStat[]).map((s) => [s.label, s]))))
      .catch(() => {})
    loadFolders()
  }
  useEffect(() => load(), []) // eslint-disable-line react-hooks/exhaustive-deps
  // Coming back to this tab (e.g. after importing a mock in another tab): refresh quietly, with fresh counts.
  const wasVisible = useRef(visible)
  useEffect(() => {
    if (visible && !wasVisible.current) load(true)
    wasVisible.current = visible
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 3200)
    return () => clearTimeout(t)
  }, [note])

  const inTab = (t: MockTestSummary, key: Tab) => {
    if (key === 'all') return true
    if (key === 'exams' || key === 'free') return inSection(t, key)
    if (key === 'paid') return t.access === 'paid'
    if (key === 'pdf') return t.pdfDownload
    if (key === 'hidden') return t.sections.length === 0 && t.courseGroups.length === 0
    if (key.startsWith('g:')) return t.courseGroups.includes(key.slice(2))
    return t.folderIds.includes(key)
  }

  const tabCount = (key: Tab) => (tests ?? []).filter((t) => inTab(t, key)).length
  const folderName = (id: string) => folders.find((f) => f.id === id)?.name ?? ''

  /** Change one mock's lists / paid flag / PDF permission / groups / folders (optimistic, rolled back on error). */
  async function patchMock(label: string, patch: Patch, okText?: string) {
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

  /** Add / remove / set something on MANY mocks with one request. */
  async function bulk(labels: string[], add: Lists, remove: Lists, set: BulkSet, okText: string) {
    if (labels.length === 0) return
    const before = tests
    setTests((cur) => (cur ?? []).map((t) => (labels.includes(t.label) ? applyBulk(t, add, remove, set) : t)))
    try {
      const res = await fetch('/api/admin/test-config/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels, add, remove, set }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Saqlab bo‘lmadi.')
      setNote({ ok: true, text: okText })
    } catch (e) {
      setTests(before)
      setNote({ ok: false, text: e instanceof Error ? e.message : "Server bilan bog'lanib bo'lmadi." })
    }
  }

  function toggleFolder(t: MockTestSummary, id: string) {
    const on = t.folderIds.includes(id)
    patchMock(t.label, { folderIds: on ? t.folderIds.filter((x) => x !== id) : [...t.folderIds, id] })
  }
  function toggleSection(t: MockTestSummary, s: MockSection) {
    patchMock(t.label, { sections: t.sections.includes(s) ? t.sections.filter((x) => x !== s) : [...t.sections, s] })
  }
  function toggleGroup(t: MockTestSummary, slug: string) {
    patchMock(t.label, { courseGroups: t.courseGroups.includes(slug) ? t.courseGroups.filter((x) => x !== slug) : [...t.courseGroups, slug] })
  }
  function toggleSelected(label: string) {
    setSelected((cur) => {
      const n = new Set(cur)
      if (n.has(label)) n.delete(label)
      else n.add(label)
      return n
    })
  }

  /** Drop on a bo'lim: ADDS the mock (or, when it is one of the ticked mocks, all ticked mocks). */
  function dropOn(key: Tab) {
    const label = dragLabel
    setDragLabel(null)
    setOverTab(null)
    const t = (tests ?? []).find((x) => x.label === label)
    if (!t || key === 'all' || key === 'hidden') return
    const labels = selected.has(t.label) ? [...selected] : [t.label]
    const many = labels.length > 1
    const who = many ? `${labels.length} ta mock` : `"${t.label}"`
    if (key === 'exams' || key === 'free') {
      const name = key === 'exams' ? 'All Past Exams' : 'Free Mocks'
      if (!many && inSection(t, key)) return setNote({ ok: true, text: `"${t.label}" allaqachon ${name} da.` })
      bulk(labels, { sections: [key] }, {}, {}, `${who} → ${name}`)
    } else if (key === 'paid') {
      bulk(labels, {}, {}, { access: 'paid' }, `${who} → Pullik`)
    } else if (key === 'pdf') {
      bulk(labels, {}, {}, { pdfDownload: true }, `${who}: PDF yuklab olish yoqildi`)
    } else if (key.startsWith('g:')) {
      const slug = key.slice(2)
      bulk(labels, { courseGroups: [slug] }, {}, {}, `${who} → ${groupBySlug(slug)?.short ?? slug} guruhi`)
    } else {
      if (!many && t.folderIds.includes(key)) return setNote({ ok: true, text: `"${t.label}" allaqachon "${folderName(key)}" bo‘limida.` })
      bulk(labels, { folderIds: [key] }, {}, {}, `${who} → ${folderName(key)}`)
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
  const shown = useMemo(() => {
    const list = (tests ?? []).filter(
      (t) =>
        inTab(t, tab) &&
        (filter === 'all' || (filter === 'draft' ? !t.published : t.published)) &&
        t.label.toLowerCase().includes(query.trim().toLowerCase()),
    )
    const byName = (a: MockTestSummary, b: MockTestSummary) => a.label.localeCompare(b.label, undefined, { numeric: true })
    if (sort === 'name') return [...list].sort(byName)
    if (sort === 'newest') return [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || byName(a, b))
    if (sort === 'solved') return [...list].sort((a, b) => (stats[b.label]?.attempts ?? 0) - (stats[a.label]?.attempts ?? 0) || byName(a, b))
    if (sort === 'draft') return [...list].sort((a, b) => Number(a.published) - Number(b.published))
    return list // 'manual': the order the server sent (the admin's own order, then A–Z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tests, tab, filter, query, sort, stats, folders])

  /** Save a new order for the mocks on screen; mocks that are filtered out keep their places. */
  async function commitShownOrder(newShown: string[]) {
    const cur = tests ?? []
    const shownSet = new Set(shown.map((t) => t.label))
    const next = cur.map((t) => t.label)
    // slots of the shown mocks, in list order, receive the new order
    const slots = cur.map((t, i) => (shownSet.has(t.label) ? i : -1)).filter((i) => i >= 0)
    slots.forEach((slot, k) => (next[slot] = newShown[k]))
    const byLabel = new Map(cur.map((t) => [t.label, t]))
    const before = tests
    setTests(next.map((l, i) => ({ ...byLabel.get(l)!, sortOrder: (i + 1) * 10 })))
    try {
      const res = await fetch('/api/admin/test-config/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: next }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Saqlab bo‘lmadi.')
    } catch (e) {
      setTests(before)
      setNote({ ok: false, text: e instanceof Error ? e.message : "Server bilan bog'lanib bo'lmadi." })
    }
  }
  function moveMock(label: string, dir: -1 | 1) {
    const labels = shown.map((t) => t.label)
    const i = labels.indexOf(label)
    const j = i + dir
    if (i < 0 || j < 0 || j >= labels.length) return
    ;[labels[i], labels[j]] = [labels[j], labels[i]]
    commitShownOrder(labels)
  }
  function moveToEdge(label: string, edge: 'top' | 'bottom') {
    const labels = shown.map((t) => t.label).filter((l) => l !== label)
    commitShownOrder(edge === 'top' ? [label, ...labels] : [...labels, label])
  }
  function reorderTo(from: string, to: string) {
    const labels = shown.map((t) => t.label)
    const i = labels.indexOf(from)
    const j = labels.indexOf(to)
    if (i < 0 || j < 0 || i === j) return
    const [m] = labels.splice(i, 1)
    labels.splice(j, 0, m)
    commitShownOrder(labels)
  }

  const tabButton = (key: Tab, label: string, hint: string, opts?: { folder?: MockFolder }) => {
    const active = tab === key
    const droppable = key !== 'all' && key !== 'hidden'
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
          {key === 'pdf' && <FileDown size={11} />}
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
        {COURSE_GROUPS.map((g) => tabButton(gKey(g.slug), `Guruh · ${g.short}`, `Mockni shu yerga tashlasangiz ${g.title} guruhiga ham beriladi`))}
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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Saralash"
          className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] font-bold text-ink-soft focus:border-green focus:outline-none"
        >
          {SORTS.map((o) => (
            <option key={o.key} value={o.key}>
              Tartib: {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          title="Ro‘yxatni yangilash (savollar sonini qayta hisoblaydi)"
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-bold text-ink-soft hover:border-green disabled:opacity-60"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Yangilash
        </button>
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

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          total={shown.length}
          folders={folders}
          onSelectAll={() => setSelected(new Set(shown.map((t) => t.label)))}
          onClear={() => setSelected(new Set())}
          onApply={(add, remove, set, text) => bulk([...selected], add, remove, set, `${selected.size} ta mock: ${text}`)}
        />
      )}
      {selected.size === 0 && shown.length > 1 && (
        <button
          type="button"
          onClick={() => setSelected(new Set(shown.map((t) => t.label)))}
          className="mb-2 text-[12px] font-bold text-green-deep underline underline-offset-2"
        >
          Hammasini tanlash ({shown.length}) — bir nechta mockni birdaniga boshqa bo‘limga qo‘shish uchun
        </button>
      )}

      {sort === 'manual' && shown.length > 1 && (
        <p className="mb-2 text-[11.5px] text-ink-faint">
          Tartiblash: qatorni sudrab boshqa qator ustiga tashlang yoki o‘ngdagi ▲ ▼ tugmalarni bosing. Bu tartib o‘quvchilarning <b>Free Mocks</b> ro‘yxatida ham shunday ko‘rinadi.
        </p>
      )}

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
          {shown.map((t, rowIdx) => {
            const s = stats[t.label]
            const isOpen = open === t.label
            const toggle = () => setOpen(isOpen ? null : t.label)
            const manual = sort === 'manual'
            const isTarget = manual && overRow === t.label && dragLabel !== null && dragLabel !== t.label
            return (
              <div
                key={t.label}
                onDragOver={manual && dragLabel && dragLabel !== t.label ? (e) => (e.preventDefault(), setOverRow(t.label)) : undefined}
                onDragLeave={manual ? () => setOverRow((o) => (o === t.label ? null : o)) : undefined}
                onDrop={
                  manual
                    ? (e) => {
                        if (!dragLabel || dragLabel === t.label) return
                        e.preventDefault()
                        const from = dragLabel
                        setDragLabel(null)
                        setOverRow(null)
                        setOverTab(null)
                        reorderTo(from, t.label)
                      }
                    : undefined
                }
                className={`overflow-hidden rounded-xl border bg-white transition-all ${
                  dragLabel === t.label ? 'border-green opacity-60' : isTarget ? 'border-green ring-2 ring-green/50' : 'border-line'
                }`}
              >
                {/* Only this header area is draggable, so the inputs below keep normal text selection. */}
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', t.label)
                    e.dataTransfer.effectAllowed = 'copyMove'
                    setDragLabel(t.label)
                  }}
                  onDragEnd={() => {
                    setDragLabel(null)
                    setOverTab(null)
                    setOverRow(null)
                  }}
                  className="px-3 pb-2.5 pt-3 hover:bg-bg-deep/40"
                >
                  {/* line 1: select · drag · name · order · numbers */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <input
                      type="checkbox"
                      checked={selected.has(t.label)}
                      onChange={() => toggleSelected(t.label)}
                      aria-label={`${t.label} ni tanlash`}
                      className="size-4 shrink-0 accent-green"
                    />
                    <GripVertical size={16} className="shrink-0 cursor-grab text-ink-faint" aria-label="Sudrab tartiblash yoki bo'limga qo'shish" />
                    {manual && (
                      <span className="flex shrink-0 items-center overflow-hidden rounded-md border border-line bg-white">
                        <button
                          type="button"
                          disabled={rowIdx === 0}
                          onClick={() => moveMock(t.label, -1)}
                          onDoubleClick={() => moveToEdge(t.label, 'top')}
                          title="Yuqoriga (ikki marta bosish — eng boshiga)"
                          className="px-1.5 py-1 text-ink-soft hover:bg-bg-deep disabled:opacity-30"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={rowIdx === shown.length - 1}
                          onClick={() => moveMock(t.label, 1)}
                          onDoubleClick={() => moveToEdge(t.label, 'bottom')}
                          title="Pastga (ikki marta bosish — eng oxiriga)"
                          className="border-l border-line px-1.5 py-1 text-ink-soft hover:bg-bg-deep disabled:opacity-30"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </span>
                    )}
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
                        {((t.placement === 'mock' && t.sections.length === 0) || t.placement === 'course_task') && t.courseGroups.length === 0 && (
                          <span className="rounded-full bg-red-100 px-1.5 py-px text-[9.5px] font-extrabold text-red-700" title="Bu mock hech qaysi bo‘limda ko‘rinmayapti">
                            KO‘RINMAYDI
                          </span>
                        )}
                        {t.placement === 'course_task' && (
                          <span className="rounded-full bg-sky-100 px-1.5 py-px text-[9.5px] font-extrabold text-sky-800">
                            VAZIFA{t.recommendedMinutes ? ` · ${t.recommendedMinutes} daq` : ''}
                          </span>
                        )}
                        {t.hasVideo && (
                          <span className="flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-px text-[9.5px] font-extrabold text-orange-800">
                            <MonitorPlay size={10} /> VIDEO
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-ink-faint">
                        {t.subject === 'full' ? 'Full' : t.subject === 'math' ? 'Math' : 'English'} · R&W {t.readingCount} · Math {t.mathCount}
                      </div>
                    </button>
                    <button type="button" onClick={toggle} className="flex items-center gap-4">
                      <Stat icon={<BarChart3 size={13} />} label="yechilgan" value={s?.attempts ?? 0} />
                      <Stat icon={<Users size={13} />} label="o'quvchi" value={s?.users ?? 0} />
                      <Stat label="o'rtacha" value={s?.avgScore ?? '—'} />
                      <Stat label="eng yuqori" value={s?.bestScore ?? '—'} />
                      <ChevronDown size={16} className={`text-ink-faint transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* line 2: where the mock is shown — toggles; plus the admin's own PDF download */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:pl-[28px]">
                    <PlaceBtn active={inSection(t, 'exams')} tone="blue" onClick={() => toggleSection(t, 'exams')} title="All Past Exams bo'limida ko'rsatish (yoqish / o‘chirish) — Free Mocks ga tegmaydi">
                      All Past Exams
                    </PlaceBtn>
                    <PlaceBtn active={inSection(t, 'free')} tone="orange" onClick={() => toggleSection(t, 'free')} title="Free Mocks bo'limida ko'rsatish (yoqish / o‘chirish) — All Past Exams ga tegmaydi">
                      Free Mock
                    </PlaceBtn>
                    <PlaceBtn
                      active={t.placement === 'course_task'}
                      tone="indigo"
                      onClick={() =>
                        patchMock(
                          t.label,
                          { placement: t.placement === 'course_task' ? 'mock' : 'course_task' },
                          t.placement === 'course_task'
                            ? `"${t.label}" endi oddiy mock: All Past Exams / Free Mocks ro'yxatlarida ko'rinadi.`
                            : `"${t.label}" vazifaga aylantirildi: faqat tanlangan guruhlarning "Mening kurslarim" bo'limida ko'rinadi.`,
                        )
                      }
                      title="Vazifa (faqat guruhga, vaqtsiz) yoki oddiy mock (ro'yxatlarda ko'rinadi) — bosib almashtiring"
                    >
                      {t.placement === 'course_task' && <Check size={11} />} Vazifa
                    </PlaceBtn>
                    <PlaceBtn active={t.access === 'paid'} tone="amber" onClick={() => patchMock(t.label, { access: t.access === 'paid' ? 'free' : 'paid' })} title="Pullik / bepul">
                      <Lock size={11} /> Pullik
                    </PlaceBtn>
                    {COURSE_GROUPS.map((g) => (
                      <PlaceBtn key={g.slug} active={t.courseGroups.includes(g.slug)} tone="indigo" onClick={() => toggleGroup(t, g.slug)} title={`${g.title} guruhiga berish / olib tashlash`}>
                        {t.courseGroups.includes(g.slug) && <Check size={11} />} {g.short}
                      </PlaceBtn>
                    ))}
                    {folders.map((f) => (
                      <PlaceBtn key={f.id} active={t.folderIds.includes(f.id)} tone="green" onClick={() => toggleFolder(t, f.id)} title={`"${f.name}" bo'limiga qo'shish / olib tashlash`}>
                        {t.folderIds.includes(f.id) && <Check size={11} />} {f.name}
                      </PlaceBtn>
                    ))}
                    <span className="mx-0.5 h-4 w-px bg-line" />
                    <PlaceBtn active={t.pdfDownload} tone="violet" onClick={() => patchMock(t.label, { pdfDownload: !t.pdfDownload })} title="O‘quvchi testni tugatgach savollarni PDF qilib yuklab olsinmi? (yoqish / o‘chirish)">
                      <FileDown size={11} /> O‘quvchiga PDF
                    </PlaceBtn>
                    <CopyLinkButton label={t.label} />
                    <DownloadTestPdfButton compact testTitle={t.label} loadItems={() => loadMockPdfItems(t.label)} label="PDF yuklab olish" />
                  </div>
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

/** "N ta mock tanlandi": add them to / remove them from any bo'lim at once. */
function BulkBar({
  count,
  total,
  folders,
  onSelectAll,
  onClear,
  onApply,
}: {
  count: number
  total: number
  folders: MockFolder[]
  onSelectAll: () => void
  onClear: () => void
  onApply: (add: Lists, remove: Lists, set: BulkSet, text: string) => void
}) {
  const Chip = ({ label, onAdd, onRemove }: { label: string; onAdd: () => void; onRemove: () => void }) => (
    <span className="flex items-center overflow-hidden rounded-full border border-line bg-white text-[11.5px] font-extrabold text-ink">
      <span className="px-2.5 py-1">{label}</span>
      <button type="button" onClick={onAdd} title={`${label} ga qo‘shish`} className="border-l border-line px-2 py-1 text-green-deep hover:bg-green-mist">
        <Plus size={12} />
      </button>
      <button type="button" onClick={onRemove} title={`${label} dan olib tashlash`} className="border-l border-line px-2 py-1 text-red-600 hover:bg-red-50">
        <Minus size={12} />
      </button>
    </span>
  )
  const Flip = ({ label, onOn, onOff }: { label: string; onOn: () => void; onOff: () => void }) => (
    <span className="flex items-center overflow-hidden rounded-full border border-line bg-white text-[11.5px] font-extrabold text-ink">
      <span className="px-2.5 py-1">{label}</span>
      <button type="button" onClick={onOn} className="border-l border-line px-2 py-1 text-green-deep hover:bg-green-mist">
        Yoq
      </button>
      <button type="button" onClick={onOff} className="border-l border-line px-2 py-1 text-red-600 hover:bg-red-50">
        O‘ch
      </button>
    </span>
  )
  return (
    <div className="sticky top-2 z-20 mb-3 rounded-xl border border-green bg-green-mist/90 p-3 shadow-md backdrop-blur">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12.5px] font-bold text-green-deep">
        <span>{count} ta mock tanlandi</span>
        {count < total && (
          <button type="button" onClick={onSelectAll} className="underline underline-offset-2">
            Hammasini tanlash ({total})
          </button>
        )}
        <button type="button" onClick={onClear} className="ml-auto flex items-center gap-1 rounded-lg border border-green/40 bg-white px-2 py-1 text-ink-soft">
          <X size={12} /> Bekor
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip label="All Past Exams" onAdd={() => onApply({ sections: ['exams'] }, {}, {}, 'All Past Exams ga qo‘shildi')} onRemove={() => onApply({}, { sections: ['exams'] }, {}, 'All Past Exams dan olindi')} />
        <Chip label="Free Mocks" onAdd={() => onApply({ sections: ['free'] }, {}, {}, 'Free Mocks ga qo‘shildi')} onRemove={() => onApply({}, { sections: ['free'] }, {}, 'Free Mocks dan olindi')} />
        {COURSE_GROUPS.map((g) => (
          <Chip key={g.slug} label={`Guruh · ${g.short}`} onAdd={() => onApply({ courseGroups: [g.slug] }, {}, {}, `${g.short} guruhiga berildi`)} onRemove={() => onApply({}, { courseGroups: [g.slug] }, {}, `${g.short} guruhidan olindi`)} />
        ))}
        {folders.map((f) => (
          <Chip key={f.id} label={f.name} onAdd={() => onApply({ folderIds: [f.id] }, {}, {}, `"${f.name}" ga qo‘shildi`)} onRemove={() => onApply({}, { folderIds: [f.id] }, {}, `"${f.name}" dan olindi`)} />
        ))}
        <span className="mx-1 h-5 w-px bg-green/30" />
        <Flip label="Pullik" onOn={() => onApply({}, {}, { access: 'paid' }, 'pullik qilindi')} onOff={() => onApply({}, {}, { access: 'free' }, 'bepul qilindi')} />
        <Flip label="PDF" onOn={() => onApply({}, {}, { pdfDownload: true }, 'PDF yuklab olish yoqildi')} onOff={() => onApply({}, {}, { pdfDownload: false }, 'PDF yuklab olish o‘chirildi')} />
      </div>
    </div>
  )
}

const TONES = {
  amber: 'border-amber-400 bg-amber-300 text-amber-950',
  orange: 'border-orange-500 bg-orange-500 text-white',
  blue: 'border-blue-600 bg-blue-600 text-white',
  green: 'border-green bg-green text-white',
  violet: 'border-violet-600 bg-violet-600 text-white',
  indigo: 'border-indigo-600 bg-indigo-600 text-white',
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


/** Copies the mock's share link (opens this exact mock after sign-in) — for channels and chats. */
function CopyLinkButton({ label }: { label: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    const url = mockShareUrl(window.location.origin, label)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Havolani nusxalang:', url)
    }
    setDone(true)
    setTimeout(() => setDone(false), 2500)
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Testga havolani nusxalash: odamlar shu havola orqali kirib, to'g'ridan-to'g'ri shu mockka o'tadi"
      className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition-colors ${
        done ? 'border-green bg-green-mist text-green-deep' : 'border-sky-300 bg-white text-sky-700 hover:bg-sky-50'
      }`}
    >
      {done ? <Check size={11} /> : <Link2 size={11} />}
      {done ? 'Nusxalandi' : 'Havolani nusxalash'}
    </button>
  )
}
