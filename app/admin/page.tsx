'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SupportPanel } from '@/components/admin/support-panel'
import { NotifyPanel } from '@/components/admin/notify-panel'
import { ReportsPanel } from '@/components/admin/reports-panel'
import { GroupsPanel } from '@/components/admin/groups-panel'
import { ThemeSwitch } from '@/components/marketing/theme-switch'
import {
  ArrowLeft,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  UploadCloud,
  ListChecks,
  PenSquare,
  Search,
  Trash2,
  ChevronRight,
  LayoutList,
  BarChart3,
  ShieldCheck,
  Lock,
  Globe,
  Users,
  Pencil,
  Bell,
  Flag,
  X,
  ClipboardList,
} from 'lucide-react'
import { AdminGate } from '@/components/admin/admin-gate'
import { MocksPanel } from '@/components/admin/mocks-panel'
import { StatsPanel } from '@/components/admin/stats-panel'
import { UsersPanel } from '@/components/admin/users-panel'
import { AdminsPanel } from '@/components/admin/admins-panel'
import { ModuleImportCard } from '@/components/admin/module-import-card'
import { ChoiceImageRow, uploadQuestionImage } from '@/components/admin/choice-image-slot'
import { AnswerEntry, AnswerSheet, type AnswerSection } from '@/components/admin/answer-entry'
import { PublishActions } from '@/components/admin/publish-actions'
import { SectionAccessPicker, newMockOptions, type Placement } from '@/components/admin/section-access'
import { validateQuestions } from '@/lib/admin-schema'
import { parseLatexQuestions, type LatexImportWarning } from '@/lib/latex-import'
import { parseTableQuestions, TABLE_TEMPLATE_CSV, type TableImportWarning } from '@/lib/table-import'
import type { Question, SectionKind } from '@/lib/test-data'
import type { MockTestSummary } from '@/app/api/tests/route'
import { COURSE_GROUPS } from '@/lib/course-groups'

/* ------------------------------- shared bits ------------------------------ */

async function saveModule(opts: {
  kind: SectionKind
  questions: Question[]
  testLabel: string
  moduleNumber?: 1 | 2
  /** false for the general skill bank, which is purely additive — never wipe it. */
  replace?: boolean
}): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: opts.kind,
        questions: opts.questions,
        testLabel: opts.testLabel,
        moduleNumber: opts.moduleNumber,
        // Mock creation/editing always "sets this module to exactly this"
        // (safe against duplicate submits); the skill bank stays additive.
        replace: opts.replace ?? true,
      }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, message: data.error ?? 'Saqlashda xatolik yuz berdi.' }
    return { ok: true, message: `${data.inserted} ta savol saqlandi.` }
  } catch {
    return { ok: false, message: "Server bilan bog'lanib bo'lmadi." }
  }
}

async function saveTestConfig(opts: {
  testLabel: string
  subject: 'full' | 'math' | 'english'
  mathLayout?: 'modules' | 'sequential'
}) {
  try {
    await fetch('/api/admin/test-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testLabel: opts.testLabel,
        subject: opts.subject,
        scored: true,
        placement: 'mock',
        sections: newMockOptions.sections,
        access: newMockOptions.access,
        pdfDownload: newMockOptions.pdf,
        englishModuleMinutes: 32,
        mathModuleMinutes: 35,
        mathLayout: opts.mathLayout ?? 'modules',
        // A freshly saved mock starts as a draft: check it in the exam
        // preview ("Check it now"), fix the layout, then Publish.
        published: false,
      }),
    })
  } catch {
    // Non-fatal — the test still works with default settings.
  }
}

function ResultBanner({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result) return null
  return (
    <div
      className={`flex items-start gap-2 text-[12.5px] mt-3 font-semibold ${
        result.ok ? 'text-green-deep' : 'text-red-600'
      }`}
    >
      {result.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
      {result.message}
    </div>
  )
}

/** Shown right after a mock is saved: loads EVERY module of the mock and
 *  renders them all on one page (scroll down for the next module — no tabs),
 *  as a single answer sheet that is submitted in one request at the end. */
function PostSaveAnswerEntry({
  testLabel,
  targets,
}: {
  testLabel: string
  targets: { kind: SectionKind; moduleNumber?: 1 | 2; label: string }[]
}) {
  const [sections, setSections] = useState<AnswerSection[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrorMsg(null)
    Promise.all(
      targets.map(async (t) => {
        const params = new URLSearchParams({ testLabel, kind: t.kind })
        if (t.moduleNumber) params.set('module', String(t.moduleNumber))
        const d = await fetch(`/api/admin/questions?${params.toString()}`).then((r) => r.json())
        return {
          key: `${t.kind}-${t.moduleNumber ?? 'seq'}`,
          label: t.label,
          questions: (d.questions ?? []) as (Question & { id: string })[],
        } satisfies AnswerSection
      }),
    )
      .then((s) => {
        if (!cancelled) setSections(s.filter((x) => x.questions.length > 0))
      })
      .catch(() => {
        if (!cancelled) setErrorMsg("Savollarni yuklab bo'lmadi.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testLabel])

  return (
    <div className="mt-5 border-t border-line pt-4 pb-20">
      <PublishActions testLabel={testLabel} variant="floating" />
      <div className="text-[13px] font-bold text-ink-soft mb-1">
        Endi to&apos;g&apos;ri javoblarni kiriting
      </div>
      <p className="text-[12px] text-ink-faint mb-3">
        Barcha modullar pastma-past turibdi. Hammasini belgilab bo&apos;lgach, eng pastdagi tugmani bosing —
        hamma javoblar bir martada saqlanadi.
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-[12.5px] text-ink-faint py-3">
          <Loader2 size={14} className="animate-spin" /> Yuklanmoqda...
        </div>
      ) : errorMsg ? (
        <div className="text-[12.5px] text-red-600">{errorMsg}</div>
      ) : !sections || sections.length === 0 ? (
        <p className="text-[12.5px] text-ink-faint">Savollar topilmadi.</p>
      ) : (
        <AnswerSheet key={testLabel} sections={sections} raised />
      )}
    </div>
  )
}

function MockNameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] font-bold text-ink-soft mb-1.5">Mock nomi</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Masalan: Practice Test 3"
        className="w-full px-3 py-2.5 rounded-[9px] border border-line text-[13.5px] focus:outline-none focus:border-green"
      />
    </div>
  )
}

/* ------------------------------ Full mock form ----------------------------- */

/** "Where does this mock go, and is it free?" — applies to the next mock saved below. */
function NewMockPlacement() {
  const [v, setV] = useState<Placement>({ sections: newMockOptions.sections, access: newMockOptions.access, pdf: newMockOptions.pdf })
  return (
    <div className="mb-5 rounded-3xl border border-line bg-white p-4 shadow-[0_6px_24px_rgba(0,0,0,.04)]">
      <div className="mb-2.5 text-[12px] font-extrabold uppercase tracking-wide text-ink-faint">Bo&apos;lim va kirish rejimi</div>
      <SectionAccessPicker
        sections={v.sections}
        access={v.access}
        pdf={v.pdf}
        onChange={(n) => {
          newMockOptions.sections = n.sections
          newMockOptions.access = n.access
          newMockOptions.pdf = n.pdf
          setV(n)
        }}
      />
    </div>
  )
}

function FullMockForm() {
  const [mockName, setMockName] = useState('')
  const [eng1, setEng1] = useState<Question[] | null>(null)
  const [eng2, setEng2] = useState<Question[] | null>(null)
  const [math1, setMath1] = useState<Question[] | null>(null)
  const [math2, setMath2] = useState<Question[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedLabel, setSavedLabel] = useState<string | null>(null)

  const ready = mockName.trim() && eng1 && eng2 && math1 && math2

  async function handleSave() {
    if (!ready || !eng1 || !eng2 || !math1 || !math2) return
    setSaving(true)
    setResult(null)
    setSavedLabel(null)
    const label = mockName.trim()
    await saveTestConfig({ testLabel: label, subject: 'full' })
    const results = await Promise.all([
      saveModule({ kind: 'reading', questions: eng1, testLabel: label, moduleNumber: 1 }),
      saveModule({ kind: 'reading', questions: eng2, testLabel: label, moduleNumber: 2 }),
      saveModule({ kind: 'math', questions: math1, testLabel: label, moduleNumber: 1 }),
      saveModule({ kind: 'math', questions: math2, testLabel: label, moduleNumber: 2 }),
    ])
    const failed = results.find((r) => !r.ok)
    setResult(
      failed
        ? { ok: false, message: failed.message }
        : { ok: true, message: `"${label}" mock to'liq saqlandi — 27+27 R&W, 22+22 Math.` },
    )
    if (!failed) setSavedLabel(label)
    setSaving(false)
  }

  return (
    <div>
      <MockNameField value={mockName} onChange={setMockName} />
      <div className="text-[12.5px] font-bold text-ink-soft mb-2">English savollarini JSON variantini tashlang</div>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <ModuleImportCard title="1-M — SAT English 1-moduldagi 27 ta savol" expectedCount={27} onChange={setEng1} />
        <ModuleImportCard title="2-M — SAT English 2-moduldagi 27 ta savol" expectedCount={27} onChange={setEng2} />
      </div>
      <div className="text-[12.5px] font-bold text-ink-soft mb-2">Math savollarini JSON variantini tashlang</div>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <ModuleImportCard title="1-M — SAT Math 1-moduldagi 22 ta savol" expectedCount={22} onChange={setMath1} />
        <ModuleImportCard title="2-M — SAT Math 2-moduldagi 22 ta savol" expectedCount={22} onChange={setMath2} />
      </div>
      <button
        onClick={handleSave}
        disabled={!ready || saving}
        className="w-full py-3 rounded-[10px] font-bold text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-[linear-gradient(135deg,var(--green-deep),var(--green)_65%,var(--green-bright))]"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
        {saving ? 'Saqlanmoqda...' : 'Full mockni saqlash'}
      </button>
      <ResultBanner result={result} />
      {savedLabel && (
        <PostSaveAnswerEntry
          testLabel={savedLabel}
          targets={[
            { kind: 'reading', moduleNumber: 1, label: 'Eng 1-Modul' },
            { kind: 'reading', moduleNumber: 2, label: 'Eng 2-Modul' },
            { kind: 'math', moduleNumber: 1, label: 'Math 1-Modul' },
            { kind: 'math', moduleNumber: 2, label: 'Math 2-Modul' },
          ]}
        />
      )}
    </div>
  )
}

/* --------------------------------- Math form -------------------------------- */

function MathMockForm() {
  const [layout, setLayout] = useState<'modules' | 'sequential'>('modules')
  const [mockName, setMockName] = useState('')
  const [math1, setMath1] = useState<Question[] | null>(null)
  const [math2, setMath2] = useState<Question[] | null>(null)
  const [mathAll, setMathAll] = useState<Question[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedLabel, setSavedLabel] = useState<string | null>(null)

  const ready = mockName.trim() && (layout === 'modules' ? math1 && math2 : mathAll)

  async function handleSave() {
    if (!ready) return
    setSaving(true)
    setResult(null)
    setSavedLabel(null)
    const label = mockName.trim()
    await saveTestConfig({ testLabel: label, subject: 'math', mathLayout: layout })

    const results =
      layout === 'modules'
        ? await Promise.all([
            saveModule({ kind: 'math', questions: math1!, testLabel: label, moduleNumber: 1 }),
            saveModule({ kind: 'math', questions: math2!, testLabel: label, moduleNumber: 2 }),
          ])
        : [await saveModule({ kind: 'math', questions: mathAll!, testLabel: label })]

    const failed = results.find((r) => !r.ok)
    setResult(
      failed
        ? { ok: false, message: failed.message }
        : { ok: true, message: `"${label}" Math mock saqlandi.` },
    )
    if (!failed) setSavedLabel(label)
    setSaving(false)
  }

  return (
    <div>
      <div className="mb-4">
        <div className="text-[12px] font-bold text-ink-soft mb-2">Tuzilishi</div>
        <div className="flex gap-2">
          <button
            onClick={() => setLayout('modules')}
            className={`flex-1 px-3.5 py-2.5 rounded-lg text-[12.5px] font-semibold border transition-colors text-left ${
              layout === 'modules' ? 'bg-ink text-white border-ink' : 'border-line text-ink-soft hover:border-green'
            }`}
          >
            2 modulli (haqiqiy standart)
            <div className={`text-[11px] font-normal mt-0.5 ${layout === 'modules' ? 'text-white/70' : 'text-ink-faint'}`}>
              22 + 22 ta savol, har biri alohida vaqt bilan
            </div>
          </button>
          <button
            onClick={() => setLayout('sequential')}
            className={`flex-1 px-3.5 py-2.5 rounded-lg text-[12.5px] font-semibold border transition-colors text-left ${
              layout === 'sequential' ? 'bg-ink text-white border-ink' : 'border-line text-ink-soft hover:border-green'
            }`}
          >
            Ketma-ket 44 talik
            <div className={`text-[11px] font-normal mt-0.5 ${layout === 'sequential' ? 'text-white/70' : 'text-ink-faint'}`}>
              1 dan 44 gacha bitta uzluksiz blok
            </div>
          </button>
        </div>
      </div>

      <MockNameField value={mockName} onChange={setMockName} />

      {layout === 'modules' ? (
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <ModuleImportCard title="1-M — SAT Math 1-moduldagi 22 ta savol" expectedCount={22} onChange={setMath1} />
          <ModuleImportCard title="2-M — SAT Math 2-moduldagi 22 ta savol" expectedCount={22} onChange={setMath2} />
        </div>
      ) : (
        <div className="mb-4">
          <ModuleImportCard title="SAT Math 44 ta savol (ketma-ket, 1..44)" expectedCount={44} onChange={setMathAll} />
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!ready || saving}
        className="w-full py-3 rounded-[10px] font-bold text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-[linear-gradient(135deg,var(--green-deep),var(--green)_65%,var(--green-bright))]"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
        {saving ? 'Saqlanmoqda...' : 'Math mockni saqlash'}
      </button>
      <ResultBanner result={result} />
      {savedLabel && (
        <PostSaveAnswerEntry
          testLabel={savedLabel}
          targets={
            layout === 'modules'
              ? [
                  { kind: 'math', moduleNumber: 1, label: 'Math 1-Modul' },
                  { kind: 'math', moduleNumber: 2, label: 'Math 2-Modul' },
                ]
              : [{ kind: 'math', label: 'Math (44 ta, ketma-ket)' }]
          }
        />
      )}
    </div>
  )
}

/* -------------------------------- English form ------------------------------ */

function EnglishMockForm() {
  const [mockName, setMockName] = useState('')
  const [eng1, setEng1] = useState<Question[] | null>(null)
  const [eng2, setEng2] = useState<Question[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedLabel, setSavedLabel] = useState<string | null>(null)

  const ready = mockName.trim() && eng1 && eng2

  async function handleSave() {
    if (!ready || !eng1 || !eng2) return
    setSaving(true)
    setResult(null)
    setSavedLabel(null)
    const label = mockName.trim()
    await saveTestConfig({ testLabel: label, subject: 'english' })
    const results = await Promise.all([
      saveModule({ kind: 'reading', questions: eng1, testLabel: label, moduleNumber: 1 }),
      saveModule({ kind: 'reading', questions: eng2, testLabel: label, moduleNumber: 2 }),
    ])
    const failed = results.find((r) => !r.ok)
    setResult(
      failed ? { ok: false, message: failed.message } : { ok: true, message: `"${label}" English mock saqlandi.` },
    )
    if (!failed) setSavedLabel(label)
    setSaving(false)
  }

  return (
    <div>
      <MockNameField value={mockName} onChange={setMockName} />
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <ModuleImportCard title="1-M — SAT English 1-moduldagi 27 ta savol" expectedCount={27} onChange={setEng1} />
        <ModuleImportCard title="2-M — SAT English 2-moduldagi 27 ta savol" expectedCount={27} onChange={setEng2} />
      </div>
      <button
        onClick={handleSave}
        disabled={!ready || saving}
        className="w-full py-3 rounded-[10px] font-bold text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-[linear-gradient(135deg,var(--green-deep),var(--green)_65%,var(--green-bright))]"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
        {saving ? 'Saqlanmoqda...' : 'English mockni saqlash'}
      </button>
      <ResultBanner result={result} />
      {savedLabel && (
        <PostSaveAnswerEntry
          testLabel={savedLabel}
          targets={[
            { kind: 'reading', moduleNumber: 1, label: 'Eng 1-Modul' },
            { kind: 'reading', moduleNumber: 2, label: 'Eng 2-Modul' },
          ]}
        />
      )}
    </div>
  )
}

/* ------------------------------ Task (vazifa) form -------------------------- */

/**
 * A "vazifa": any number of questions, no 800/1600 score, no fixed time. The student's clock
 * counts UP. An optional suggested time ("Tavsiya etilgan vaqt") is shown once on the start screen.
 * It is attached to a course group right here (or left unattached and attached later in Mocklar).
 */
function TaskForm() {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState<'math' | 'english'>('math')
  const [groups, setGroups] = useState<string[]>([])
  const [minutes, setMinutes] = useState('')
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedLabel, setSavedLabel] = useState<string | null>(null)

  const ready = name.trim() && questions && questions.length > 0
  const kind: SectionKind = subject === 'math' ? 'math' : 'reading'

  async function handleSave() {
    if (!ready || !questions) return
    setSaving(true)
    setResult(null)
    setSavedLabel(null)
    const label = name.trim()
    const mins = Number(minutes)
    try {
      const res = await fetch('/api/admin/test-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testLabel: label,
          subject,
          scored: false,
          placement: 'course_task',
          sections: ['exams'],
          access: 'free',
          courseGroups: groups,
          recommendedMinutes: mins > 0 ? mins : null,
          // Saved as a draft: check it with "Check it now", then Publish.
          published: false,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResult({ ok: false, message: d.error ?? 'Sozlamani saqlab bo‘lmadi.' })
        setSaving(false)
        return
      }
    } catch {
      setResult({ ok: false, message: "Server bilan bog'lanib bo'lmadi." })
      setSaving(false)
      return
    }
    const r = await saveModule({ kind, questions, testLabel: label })
    setResult(
      r.ok
        ? {
            ok: true,
            message: `"${label}" vazifasi saqlandi — ${questions.length} ta savol${groups.length ? `, guruh: ${groups.map((g) => COURSE_GROUPS.find((c) => c.slug === g)?.title).join(' + ')}` : ''}. Hozircha DRAFT.`,
          }
        : r,
    )
    if (r.ok) setSavedLabel(label)
    setSaving(false)
  }

  return (
    <div>
      <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[12.5px] leading-relaxed text-sky-900">
        <b>Vazifa</b> — savollar soni istalgancha (44 bo&apos;lishi shart emas). Ball (800/1600) hisoblanmaydi, faqat to&apos;g&apos;ri/xato ko&apos;rsatiladi.
        Vaqt cheklanmaydi: o&apos;quvchida taymer <b>yuqoriga</b> sanab, nechi daqiqa ketganini ko&apos;rsatib turadi.
      </div>

      <MockNameField value={name} onChange={setName} />

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[12px] font-bold text-ink-soft">Fan</div>
          <div className="flex gap-2">
            {(
              [
                ['math', 'Math'],
                ['english', 'English (R&W)'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setSubject(v)}
                className={`flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                  subject === v ? 'border-ink bg-ink text-white' : 'border-line text-ink-soft hover:border-green'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-bold text-ink-soft">Tavsiya etilgan vaqt (daqiqa, ixtiyoriy)</label>
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            inputMode="numeric"
            placeholder="Masalan: 50"
            className="w-full rounded-[9px] border border-line px-3 py-2 text-[13.5px] focus:border-green focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-ink-faint">O&apos;quvchi boshlaganda bir marta &quot;Tavsiya etilgan vaqt: 50 daqiqa&quot; deb ko&apos;rsatiladi. Majburiy emas.</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-[12px] font-bold text-ink-soft">Qaysi guruh(lar)ga beriladi (bir nechtasini tanlash mumkin)</div>
        <div className="flex flex-wrap gap-2">
          {COURSE_GROUPS.map((g) => {
            const on = groups.includes(g.slug)
            return (
              <button
                key={g.slug}
                type="button"
                onClick={() => setGroups((cur) => (on ? cur.filter((x) => x !== g.slug) : [...cur, g.slug]))}
                aria-pressed={on}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  on ? 'border-sky-600 bg-sky-600 text-white' : 'border-line text-ink-soft hover:border-sky-400'
                }`}
              >
                {on ? '✓ ' : ''}
                {g.title}
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-[11px] text-ink-faint">Hech biri tanlanmasa, vazifa hech kimga ko&apos;rinmaydi — keyin Guruhlar bo&apos;limidan berasiz.</p>
      </div>

      <div className="mb-4">
        <ModuleImportCard
          title={`${subject === 'math' ? 'Math' : 'English'} savollari — istalgancha sonda (JSON)`}
          expectedCount={null}
          onChange={setQuestions}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!ready || saving}
        className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(135deg,var(--green-deep),var(--green)_65%,var(--green-bright))] py-3 text-[14px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
        {saving ? 'Saqlanmoqda...' : 'Vazifani saqlash'}
      </button>
      <ResultBanner result={result} />
      {savedLabel && <PostSaveAnswerEntry testLabel={savedLabel} targets={[{ kind, label: `${subject === 'math' ? 'Math' : 'English'} (barcha savollar)` }]} />}
    </div>
  )
}

/* ------------------------------ Edit test browser --------------------------- */

type ModuleTarget = { kind: SectionKind; moduleNumber?: 1 | 2; label: string }

function modulesFor(test: MockTestSummary): ModuleTarget[] {
  // A task / unscored practice set is one flat list of any length (no modules).
  if (test.subject !== 'full' && (test.placement === 'course_task' || !test.scored)) {
    return [{ kind: test.subject === 'math' ? 'math' : 'reading', label: 'Vazifa savollari (istalgancha)' }]
  }
  if (test.subject === 'full') {
    return [
      { kind: 'reading', moduleNumber: 1, label: 'Eng 1-Modul' },
      { kind: 'reading', moduleNumber: 2, label: 'Eng 2-Modul' },
      { kind: 'math', moduleNumber: 1, label: 'Math 1-Modul' },
      { kind: 'math', moduleNumber: 2, label: 'Math 2-Modul' },
    ]
  }
  if (test.subject === 'math') {
    return test.mathLayout === 'sequential'
      ? [{ kind: 'math', label: 'Math (44 ta, ketma-ket)' }]
      : [
          { kind: 'math', moduleNumber: 1, label: 'Math 1-Modul' },
          { kind: 'math', moduleNumber: 2, label: 'Math 2-Modul' },
        ]
  }
  return [
    { kind: 'reading', moduleNumber: 1, label: 'Eng 1-Modul' },
    { kind: 'reading', moduleNumber: 2, label: 'Eng 2-Modul' },
  ]
}

type LoadedModule = {
  target: ModuleTarget
  initialRaw: string
  /** Normalised JSON of the questions as loaded — a module is saved only if it differs. */
  baseline: string
}

/** Full-screen editor: every module of the test on one page (like adding a new test),
 *  one save button for the questions, and the answer sheet underneath. */
function TestEditorModal({ test, onClose, onChanged }: { test: MockTestSummary; onClose: () => void; onChanged: () => void }) {
  const targets = useMemo(() => modulesFor(test), [test])
  const [modules, setModules] = useState<LoadedModule[] | null>(null)
  const [current, setCurrent] = useState<Record<string, Question[] | null>>({})
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [answersKey, setAnswersKey] = useState(0)
  const keyOf = (t: ModuleTarget) => `${t.kind}-${t.moduleNumber ?? 'seq'}`

  useEffect(() => {
    let off = false
    Promise.all(
      targets.map(async (t): Promise<LoadedModule> => {
        const params = new URLSearchParams({ testLabel: test.label, kind: t.kind })
        if (t.moduleNumber) params.set('module', String(t.moduleNumber))
        const d = await fetch(`/api/admin/questions?${params.toString()}`).then((r) => r.json())
        const list = ((d.questions ?? []) as (Question & { id: string; moduleNumber?: number })[]).map((q) => {
          const { id: _id, moduleNumber: _mn, ...rest } = q
          return rest
        })
        return { target: t, initialRaw: list.length ? JSON.stringify(list, null, 2) : '', baseline: JSON.stringify(list) }
      }),
    )
      .then((m) => !off && setModules(m))
      .catch(() => !off && setModules([]))
    return () => {
      off = true
    }
  }, [test.label, targets])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const changed = (modules ?? []).filter((m) => {
    const c = current[keyOf(m.target)]
    return c && JSON.stringify(c) !== m.baseline
  })

  async function saveQuestions() {
    if (changed.length === 0) return
    setSaving(true)
    setResult(null)
    const results = await Promise.all(
      changed.map((m) =>
        saveModule({
          kind: m.target.kind,
          questions: current[keyOf(m.target)]!,
          testLabel: test.label,
          moduleNumber: m.target.moduleNumber,
        }),
      ),
    )
    const failed = results.find((r) => !r.ok)
    setResult(failed ?? { ok: true, message: `${changed.length} ta modul yangilandi.` })
    if (!failed) {
      // The saved text is the new baseline; reload the answer sheet (ids may have changed).
      setModules((prev) =>
        (prev ?? []).map((m) => {
          const c = current[keyOf(m.target)]
          return c && changed.includes(m) ? { ...m, baseline: JSON.stringify(c) } : m
        }),
      )
      setAnswersKey((k) => k + 1)
      onChanged()
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 px-3 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-5xl rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-ink-faint">Testni tahrirlash</div>
            <h2 className="truncate text-[19px] font-extrabold text-ink">{test.label}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line text-ink-soft hover:border-green"
          >
            <X size={16} />
          </button>
        </div>

        <PublishActions testLabel={test.label} onChange={onChanged} />

        {modules === null ? (
          <div className="flex items-center gap-2 py-6 text-[13px] text-ink-faint">
            <Loader2 size={15} className="animate-spin" /> Barcha modullar yuklanmoqda...
          </div>
        ) : (
          <>
            <div className="mb-2 text-[12.5px] font-bold text-ink-soft">Savollar (JSON) — tahrirlab, pastdagi tugmani bosing</div>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {modules.map((m) => (
                <ModuleImportCard
                  key={`${test.label}-${keyOf(m.target)}`}
                  title={`${m.target.label} — joriy savollar`}
                  expectedCount={test.placement === 'course_task' || !test.scored ? null : m.target.kind === 'math' ? (m.target.moduleNumber ? 22 : 44) : 27}
                  initialRaw={m.initialRaw}
                  onChange={(q) => setCurrent((c) => ({ ...c, [keyOf(m.target)]: q }))}
                />
              ))}
            </div>
            <button
              onClick={saveQuestions}
              disabled={changed.length === 0 || saving}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(135deg,var(--green-deep),var(--green)_65%,var(--green-bright))] py-3 text-[14px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              {saving ? 'Saqlanmoqda...' : changed.length ? `${changed.length} ta o'zgargan modulni saqlash` : "O'zgarish yo'q"}
            </button>
            <ResultBanner result={result} />

            <div className="mt-6 border-t border-line pt-4 pb-4">
              <div className="mb-1 text-[13px] font-bold text-ink-soft">To&apos;g&apos;ri javoblar</div>
              <p className="mb-3 text-[12px] text-ink-faint">
                Hamma modullar pastma-past — javoblarni belgilab, eng pastdagi tugmani bosing, hammasi bir martada saqlanadi.
              </p>
              <PostSaveAnswerEntry key={`${test.label}-${answersKey}`} testLabel={test.label} targets={targets} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function EditTestBrowser() {
  const [tests, setTests] = useState<MockTestSummary[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<MockTestSummary | null>(null)

  function refreshTests() {
    fetch('/api/tests?all=1')
      .then((r) => r.json())
      .then((d) => setTests(d.tests ?? []))
      .catch(() => {})
  }

  useEffect(refreshTests, [])

  const filtered = useMemo(
    () => tests.filter((t) => t.label.toLowerCase().includes(query.trim().toLowerCase())),
    [tests, query],
  )

  return (
    <div>
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mock nomi bo'yicha qidirish..."
          className="w-full pl-9 pr-3 py-2.5 rounded-[9px] border border-line text-[13.5px] focus:outline-none focus:border-green"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-[13px] text-ink-faint">Hozircha hech qanday mock topilmadi.</p>
      ) : (
        <div className="space-y-2 mb-5">
          {filtered.map((t) => (
            <div key={t.label} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-2 text-[13.5px] font-bold">
                  <span className="truncate">{t.label}</span>
                  {t.published === false && (
                    <span className="rounded-full bg-amber-400 px-1.5 py-px text-[9.5px] font-extrabold tracking-wide text-amber-950">
                      DRAFT
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-ink-faint">
                  {t.placement === 'course_task'
                    ? `Vazifa · ${t.subject === 'math' ? t.mathCount : t.readingCount} ta savol${t.courseGroups?.length ? ` · ${t.courseGroups.join(' + ')}` : ''}`
                    : t.subject === 'full'
                    ? `R&W ${t.readingCount} · Math ${t.mathCount}`
                    : t.subject === 'math'
                      ? `Math ${t.mathCount} ta (${t.mathLayout === 'sequential' ? 'ketma-ket' : '2 modulli'})`
                      : `R&W ${t.readingCount} ta`}
                </div>
              </div>
              <button
                onClick={() => setEditing(t)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-green bg-green-mist px-3.5 py-2 text-[12.5px] font-bold text-green-deep transition-colors hover:bg-white"
              >
                <Pencil size={14} /> Tahrirlash
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && <TestEditorModal key={editing.label} test={editing} onClose={() => setEditing(null)} onChanged={refreshTests} />}

      <QuestionIdLookup />
    </div>
  )
}

/** "savol ID raqami bo'yicha qidirish" — paste a question's own database id
 *  (never typed in by hand when creating; only useful once you already have
 *  one, e.g. to fix a single typo without re-pasting a whole module). */
function QuestionIdLookup() {
  const [id, setId] = useState('')
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [question, setQuestion] = useState<(Question & { id: string; kind: SectionKind }) | null>(null)
  const [raw, setRaw] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleLookup() {
    if (!id.trim()) return
    setLoading(true)
    setNotFound(null)
    setQuestion(null)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/questions/${encodeURIComponent(id.trim())}`)
      const data = await res.json()
      if (!res.ok) {
        setNotFound(data.error ?? 'Topilmadi.')
      } else {
        setQuestion(data.question)
        setRaw(JSON.stringify(data.question, null, 2))
      }
    } catch {
      setNotFound("Server bilan bog'lanib bo'lmadi.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!question) return
    let parsedQ: Question
    try {
      parsedQ = JSON.parse(raw)
    } catch (e) {
      setResult({ ok: false, message: `JSON xato: ${e instanceof Error ? e.message : 'nomaʻlum'}` })
      return
    }
    const errors = validateQuestions([parsedQ])
    if (errors.length > 0) {
      setResult({ ok: false, message: errors[0].message })
      return
    }
    setSaving(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/questions/${encodeURIComponent(question.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: parsedQ }),
      })
      const data = await res.json()
      const rescoreSuffix =
        res.ok && typeof data.rescored === 'number' && data.rescored > 0
          ? ` ${data.rescored} ta oldingi natija qayta hisoblandi.`
          : ''
      setResult(
        res.ok
          ? { ok: true, message: `Savol yangilandi.${rescoreSuffix}` }
          : { ok: false, message: data.error },
      )
    } catch {
      setResult({ ok: false, message: "Server bilan bog'lanib bo'lmadi." })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!question) return
    setSaving(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/questions/${encodeURIComponent(question.id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        setQuestion(null)
        setRaw('')
        setId('')
        setResult({ ok: true, message: "Savol o'chirildi." })
      } else {
        setResult({ ok: false, message: data.error })
      }
    } catch {
      setResult({ ok: false, message: "Server bilan bog'lanib bo'lmadi." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-line pt-4 mt-2">
      <h3 className="text-[13.5px] font-bold mb-2 flex items-center gap-2">
        <Search size={15} className="text-green-deep" /> Savol ID raqami bo&apos;yicha qidirish
      </h3>
      <p className="text-[12px] text-ink-faint mb-2.5">
        Bitta savolda xatolik bo&apos;lsa, butun modulni qayta joylashtirmasdan shu savolning ID&apos;sini
        qidirib, faqat o&apos;shani tuzatishingiz mumkin.
      </p>
      <div className="flex gap-2 mb-3">
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Savol ID (uuid)"
          className="flex-1 font-mono px-3 py-2.5 rounded-[9px] border border-line text-[12.5px] focus:outline-none focus:border-green"
        />
        <button
          onClick={handleLookup}
          disabled={!id.trim() || loading}
          className="px-4 py-2.5 rounded-[9px] font-bold text-[12.5px] border border-line hover:border-green disabled:opacity-40 flex items-center gap-1.5"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Qidirish
        </button>
      </div>

      {notFound && (
        <div className="flex items-start gap-1.5 text-[12.5px] text-red-600 mb-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {notFound}
        </div>
      )}

      {question && (
        <div>
          <div className="text-[11.5px] text-ink-faint mb-1.5">
            {question.kind === 'math' ? 'Math' : 'Reading & Writing'} savoli — kerakli maydonlarni tahrirlang:
          </div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={10}
            className="w-full font-mono text-[12px] px-3.5 py-3 rounded-[10px] border border-line bg-bg focus:outline-none focus:border-green resize-y"
          />
          <ChoiceImagesEditor raw={raw} setRaw={setRaw} />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-[10px] font-bold text-[13px] text-white flex items-center justify-center gap-2 disabled:opacity-40 bg-[linear-gradient(135deg,var(--green-deep),var(--green)_65%,var(--green-bright))]"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Saqlash
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2.5 rounded-[10px] font-bold text-[13px] border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Trash2 size={14} /> O&apos;chirish
            </button>
          </div>
          <ResultBanner result={result} />
        </div>
      )}
    </div>
  )
}

/** Under the JSON of one question: upload / remove the pictures of its answer options (writes them into the JSON). */
function ChoiceImagesEditor({ raw, setRaw }: { raw: string; setRaw: (s: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  let q: Question | null = null
  try {
    q = JSON.parse(raw) as Question
  } catch {
    q = null
  }
  if (!q || (q.type ?? 'mcq') !== 'mcq' || !Array.isArray(q.choices) || q.choices.length === 0) return null
  const cur: Question = q

  const urls: Record<string, string | undefined> = {}
  cur.choices!.forEach((c) => (urls[c.id] = c.image))

  function setImage(id: string, url: string | undefined) {
    const next = { ...cur, choices: cur.choices!.map((c) => (c.id === id ? { ...c, image: url } : c)) }
    setRaw(JSON.stringify(next, null, 2))
  }

  async function upload(id: string, file: File) {
    setBusy(id)
    setError(null)
    try {
      setImage(id, await uploadQuestionImage(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yuklashda xatolik yuz berdi.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <ChoiceImageRow ids={cur.choices!.map((c) => c.id)} urls={urls} busyId={busy} onFile={upload} onClear={(id) => setImage(id, undefined)} />
      {error && (
        <div className="flex items-start gap-1.5 text-[12px] text-red-600 mt-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
    </div>
  )
}

/* --------------------------- General skill-bank import ---------------------- */
/* Secondary, collapsed section: adds questions to the shared skill bank      */
/* (no test_label) that feeds the skill-drill exercises. */
/* Kept from the previous admin panel — LaTeX/table import still work here.  */

function SkillBankImport() {
  const [kind, setKind] = useState<SectionKind>('math')
  const [raw, setRaw] = useState('')
  const [latexRaw, setLatexRaw] = useState('')
  const [latexWarnings, setLatexWarnings] = useState<LatexImportWarning[]>([])
  const [tableRaw, setTableRaw] = useState('')
  const [tableWarnings, setTableWarnings] = useState<TableImportWarning[]>([])
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const parsed = useMemo(() => {
    if (!raw.trim()) return { data: null as Question[] | null, error: null as string | null }
    try {
      return { data: JSON.parse(raw) as Question[], error: null }
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'JSON xato' }
    }
  }, [raw])
  const errors = useMemo(() => (parsed.data ? validateQuestions(parsed.data) : []), [parsed.data])
  const isValid = !parsed.error && parsed.data !== null && errors.length === 0

  function handleConvertLatex() {
    if (!latexRaw.trim()) return
    const result = parseLatexQuestions(latexRaw)
    setRaw(JSON.stringify(result.questions, null, 2))
    setLatexWarnings(result.warnings)
  }

  function handleConvertTable() {
    if (!tableRaw.trim()) return
    const result = parseTableQuestions(tableRaw)
    setRaw(JSON.stringify(result.questions, null, 2))
    setTableWarnings(result.warnings)
  }

  function downloadTemplate() {
    const blob = new Blob([TABLE_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'savollar-namuna.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSave() {
    if (!isValid || !parsed.data) return
    setSaving(true)
    setResult(null)
    const res = await saveModule({ kind, questions: parsed.data, testLabel: '', replace: false })
    setResult(res)
    if (res.ok) setRaw('')
    setSaving(false)
  }

  return (
    <div>
      <p className="text-[12.5px] text-ink-faint mb-3 leading-relaxed">
        Bu yerga qo&apos;shilgan savollar hech qanday mockka bog&apos;lanmaydi — ular umumiy savol
        bankiga tushadi va ko&apos;nikma mashqlarini (skill drills) boyitadi.
      </p>
      <div className="mb-3">
        <div className="text-[12px] font-bold text-ink-soft mb-2">Fan</div>
        <div className="flex gap-2">
          {(['math', 'reading'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold border transition-colors ${
                kind === k ? 'bg-ink text-white border-ink' : 'border-line text-ink-soft hover:border-green'
              }`}
            >
              {k === 'math' ? 'Math' : 'Reading & Writing'}
            </button>
          ))}
        </div>
      </div>

      <details className="mb-3 border border-line rounded-xl p-3.5">
        <summary className="text-[12.5px] font-bold cursor-pointer">LaTeX&apos;dan (Prism) import</summary>
        <textarea
          value={latexRaw}
          onChange={(e) => setLatexRaw(e.target.value)}
          rows={6}
          placeholder={'\\begin{question}{id}\\n...\\choices{a}{b}{c}{d}\\end{question}'}
          className="w-full font-mono text-[12px] px-3 py-2.5 mt-2 rounded-lg border border-line bg-bg focus:outline-none focus:border-green resize-y"
        />
        <button
          onClick={handleConvertLatex}
          disabled={!latexRaw.trim()}
          className="mt-2 text-[12.5px] font-bold text-green-deep bg-green-mist px-3 py-1.5 rounded-lg disabled:opacity-40"
        >
          JSON&apos;ga aylantirish
        </button>
        {latexWarnings.length > 0 && (
          <div className="mt-2 space-y-1">
            {latexWarnings.slice(0, 5).map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11.5px] text-amber-600">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {w.message}
              </div>
            ))}
          </div>
        )}
      </details>

      <details className="mb-4 border border-line rounded-xl p-3.5">
        <summary className="text-[12.5px] font-bold cursor-pointer flex items-center justify-between">
          <span>Jadval (Excel/CSV) orqali import</span>
        </summary>
        <button
          onClick={downloadTemplate}
          className="text-[11.5px] font-bold text-green-deep bg-green-mist px-2.5 py-1 rounded-lg mt-2"
        >
          Namuna (.csv) yuklab olish
        </button>
        <textarea
          value={tableRaw}
          onChange={(e) => setTableRaw(e.target.value)}
          rows={6}
          placeholder={"raqam\tturi\tsavol\tA\tB\tC\tD\tto'g'ri_javob"}
          className="w-full font-mono text-[12px] px-3 py-2.5 mt-2 rounded-lg border border-line bg-bg focus:outline-none focus:border-green resize-y"
        />
        <button
          onClick={handleConvertTable}
          disabled={!tableRaw.trim()}
          className="mt-2 text-[12.5px] font-bold text-green-deep bg-green-mist px-3 py-1.5 rounded-lg disabled:opacity-40"
        >
          JSON&apos;ga aylantirish
        </button>
        {tableWarnings.length > 0 && (
          <div className="mt-2 space-y-1">
            {tableWarnings.slice(0, 5).map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11.5px] text-amber-600">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {w.message}
              </div>
            ))}
          </div>
        )}
      </details>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={10}
        placeholder='[{ "prompt": "...", "choices": [...], "correct": "A" }, ...]'
        className="w-full font-mono text-[12.5px] px-3.5 py-3 rounded-[10px] border border-line bg-bg focus:outline-none focus:border-green resize-y"
      />
      {raw.trim() && (
        <div className="mt-2">
          {isValid && parsed.data ? (
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-green-deep">
              <CheckCircle2 size={14} /> {parsed.data.length} ta savol to&apos;g&apos;ri formatda
            </div>
          ) : (
            <div className="space-y-1">
              {(parsed.error ? [{ message: `JSON xato: ${parsed.error}` }] : errors.slice(0, 5)).map((e, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[12px] text-red-600">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {e.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={!isValid || saving}
        className="w-full mt-3 py-2.5 rounded-[10px] font-bold text-[13px] text-white flex items-center justify-center gap-2 disabled:opacity-40 bg-[linear-gradient(135deg,var(--green-deep),var(--green)_65%,var(--green-bright))]"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
        {saving ? 'Saqlanmoqda...' : 'Savol bankiga qoʻshish'}
      </button>
      <ResultBanner result={result} />
    </div>
  )
}

/* ------------------------------------ page ---------------------------------- */

type Tab = 'mocks' | 'new' | 'task' | 'groups' | 'edit' | 'bank' | 'stats' | 'users' | 'admins' | 'support' | 'notify' | 'reports'
type NewMockType = 'full' | 'math' | 'english' | null

export default function AdminPage() {
  return (
    <div className="admin-root min-h-screen">
      <AdminGate>{({ isOwner, lock }) => <AdminPanel isOwner={isOwner} onLock={lock} />}</AdminGate>
    </div>
  )
}

function AdminPanel({ isOwner, onLock }: { isOwner: boolean; onLock: () => void }) {
  const [tab, setTab] = useState<Tab>('mocks')
  const [newMockType, setNewMockType] = useState<NewMockType>(null)
  // Students' error reports still waiting for the admin (red badge on the tab).
  const [openReports, setOpenReports] = useState(0)
  function refreshReportCount() {
    fetch('/api/admin/reports?count=1')
      .then((r) => r.json())
      .then((d) => setOpenReports(typeof d?.open === 'number' ? d.open : 0))
      .catch(() => {})
  }
  useEffect(() => {
    refreshReportCount()
    const t = setInterval(refreshReportCount, 30_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    document.title = openReports > 0 ? `(${openReports}) Admin panel` : 'Admin panel'
  }, [openReports])

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-white">
        <div className="max-w-[1000px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-ink-faint hover:text-ink">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="font-serif font-semibold text-[19px]">Admin panel</h1>
              <p className="text-[12.5px] text-ink-faint">Mocklarni qo&apos;shish va tahrirlash</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitch defaultTheme="light" />
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-lg bg-green px-3 py-1.5 text-[12px] font-extrabold text-white hover:brightness-110"
            >
              <Globe size={13} /> Saytga o&apos;tish
            </Link>
            <span className="hidden sm:inline text-[11px] font-bold text-green-deep bg-green-mist px-2.5 py-1 rounded-full">
              {isOwner ? 'EGASI' : 'ADMIN'}
            </span>
            <button
              type="button"
              onClick={onLock}
              title="Panelni qulflash"
              className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-bold text-ink-soft hover:border-green"
            >
              <Lock size={12} /> Qulflash
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1000px] mx-auto px-6 py-8">
        <div className="flex flex-wrap gap-2 mb-6">
          <TabButton icon={<LayoutList size={15} />} label="Mocklar" active={tab === 'mocks'} onClick={() => setTab('mocks')} />
          <TabButton icon={<ListChecks size={15} />} label="Yangi mock qo'shish" active={tab === 'new'} onClick={() => setTab('new')} />
          <TabButton icon={<ClipboardList size={15} />} label="Vazifa qo'shish" active={tab === 'task'} onClick={() => setTab('task')} />
          <TabButton icon={<Users size={15} />} label="Guruhlar" active={tab === 'groups'} onClick={() => setTab('groups')} />
          <TabButton icon={<PenSquare size={15} />} label="Testni tahrirlash" active={tab === 'edit'} onClick={() => setTab('edit')} />
          <TabButton icon={<UploadCloud size={15} />} label="Savol banki" active={tab === 'bank'} onClick={() => setTab('bank')} />
          <TabButton icon={<BarChart3 size={15} />} label="Statistika" active={tab === 'stats'} onClick={() => setTab('stats')} />
          <TabButton icon={<Users size={15} />} label="Foydalanuvchilar" active={tab === 'users'} onClick={() => setTab('users')} />
          <TabButton icon={<MessageSquare size={15} />} label="Xabarlar" active={tab === 'support'} onClick={() => setTab('support')} />
          <TabButton icon={<Bell size={15} />} label="Bildirishnoma" active={tab === 'notify'} onClick={() => setTab('notify')} />
          <TabButton
            icon={<Flag size={15} />}
            label="Xato xabarlari"
            badge={openReports}
            active={tab === 'reports'}
            onClick={() => setTab('reports')}
          />
          <TabButton icon={<ShieldCheck size={15} />} label="Adminlar" active={tab === 'admins'} onClick={() => setTab('admins')} />
        </div>

        {/* Visited tabs stay mounted (just hidden): switching back is instant — no reload, nothing lost. */}
        <KeepAlive active={tab === 'mocks'}>
          <div className="bg-white border border-line rounded-2xl p-5">
            <MocksPanel visible={tab === 'mocks'} />
          </div>
        </KeepAlive>

        <KeepAlive active={tab === 'stats'}>
          <StatsPanel />
        </KeepAlive>
        {tab === 'support' && <SupportPanel />}
        {tab === 'notify' && <NotifyPanel />}
        {tab === 'reports' && <ReportsPanel onChanged={refreshReportCount} />}
        <KeepAlive active={tab === 'users'}>
          <UsersPanel isOwner={isOwner} />
        </KeepAlive>

        {tab === 'admins' && (
          <div className="bg-white border border-line rounded-2xl p-5">
            <AdminsPanel isOwner={isOwner} />
          </div>
        )}

        {tab === 'new' && (
          <div>
            <NewMockPlacement />
            {!newMockType && (
              <div className="grid sm:grid-cols-3 gap-3">
                <MockTypeCard
                  title="Full mock"
                  subtitle="English 2 modul (27+27) + Math 2 modul (22+22)"
                  onClick={() => setNewMockType('full')}
                />
                <MockTypeCard
                  title="Faqat Math"
                  subtitle="22+22 standart yoki ketma-ket 44 talik"
                  onClick={() => setNewMockType('math')}
                />
                <MockTypeCard
                  title="Faqat English"
                  subtitle="2 modul, 27+27 ta savol"
                  onClick={() => setNewMockType('english')}
                />
              </div>
            )}

            {newMockType && (
              <div className="bg-white border border-line rounded-2xl p-5">
                <button
                  onClick={() => setNewMockType(null)}
                  className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink-faint hover:text-ink mb-4"
                >
                  <ArrowLeft size={14} /> Orqaga
                </button>
                {newMockType === 'full' && <FullMockForm />}
                {newMockType === 'math' && <MathMockForm />}
                {newMockType === 'english' && <EnglishMockForm />}
              </div>
            )}
          </div>
        )}

        {tab === 'task' && (
          <div className="bg-white border border-line rounded-2xl p-5">
            <TaskForm />
          </div>
        )}

        <KeepAlive active={tab === 'groups'}>
          <GroupsPanel />
        </KeepAlive>

        <KeepAlive active={tab === 'edit'}>
          <div className="bg-white border border-line rounded-2xl p-5">
            <EditTestBrowser />
          </div>
        </KeepAlive>

        {tab === 'bank' && (
          <div className="bg-white border border-line rounded-2xl p-5">
            <SkillBankImport />
          </div>
        )}
      </div>
    </div>
  )
}

/** Mounts its children the first time the tab is opened, then only hides them — no re-fetch on every visit. */
function KeepAlive({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [seen, setSeen] = useState(active)
  useEffect(() => {
    if (active) setSeen(true)
  }, [active])
  if (!seen && !active) return null
  return <div hidden={!active}>{children}</div>
}

function TabButton({
  icon,
  label,
  active,
  onClick,
  badge = 0,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  /** Red counter (e.g. new error reports). */
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-bold border transition-colors ${
        active ? 'bg-ink text-white border-ink' : 'border-line text-ink-soft hover:border-green bg-white'
      }`}
    >
      {icon} {label}
      {badge > 0 && (
        <span className="ml-0.5 min-w-[18px] rounded-full bg-red-500 px-1.5 py-px text-center text-[10.5px] font-extrabold leading-4 text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

function MockTypeCard({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-line rounded-2xl p-5 hover:border-green transition-colors"
    >
      <div className="text-[15px] font-bold mb-1">{title}</div>
      <div className="text-[12px] text-ink-faint leading-relaxed">{subtitle}</div>
    </button>
  )
}
