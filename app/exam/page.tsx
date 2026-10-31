'use client'
import { paceVerdict } from '@/lib/pdf-pace'
import { SatLoader } from '@/components/sat-loader'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExamHeader } from '@/components/exam-header'
import { ExamFooter } from '@/components/exam-footer'
import { QuestionView } from '@/components/question-view'
import { ExamWatermark } from '@/components/exam-watermark'
import { CalculatorPanel, CONTENT_SHIFT, MOBILE_SHEET_HEIGHT, PANEL_LEFT_GAP } from '@/components/calculator-panel'
import { useIsMobile } from '@/lib/use-is-mobile'
import { useStableCallback } from '@/lib/use-stable-callback'
import { ReferenceSheet, REFERENCE_DEFAULT_WIDTH, REFERENCE_GAP } from '@/components/reference-sheet'
import { PreviewBar } from '@/components/preview-bar'
import { ReportQuestionButton } from '@/components/report-question'
import type { LayoutEdit } from '@/components/question-stimulus'
import { TransitionScreen } from '@/components/transition-screen'
import { ScoreReport, type ReviewItem } from '@/components/score-report'
import { PracticeResultScreen, type PracticeReviewItem } from '@/components/practice-result-screen'
import { buildSectionResult, type SectionResult } from '@/lib/scoring'
import {
  questionAt,
  isCorrectAnswer,
  type ChoiceId,
  type Question,
  type TestModule,
  type SectionKind,
} from '@/lib/test-data'
import type { TestConfig } from '@/app/api/admin/test-config/route'
import type { AnswerKey } from '@/app/api/exam/grade/route'
import type { ExamProgress } from '@/lib/exam-progress'

type Phase = 'moduleIntro' | 'testing' | 'autoNext' | 'break' | 'report'
type ScoringMode = 'full' | 'single' | 'practice'
type TimerMode = 'countdown' | 'countup'

const NO_CHOICES: ChoiceId[] = []
const BIG_BREAK_SECONDS = 10 * 60
const SHORT_BREAK_SECONDS = 5 * 60
const USER_NAME = 'Usmon Xamroyev'

/** Unique key for an answer/flag/eliminate entry: `${moduleId}:${questionIndex}` */
function keyFor(moduleId: string, qIndex: number) {
  return `${moduleId}:${qIndex}`
}

function ExamEngine({
  modules,
  testTitle,
  scoringMode,
  singleSubjectKind,
  timerMode,
  preview,
  startId,
  allowOvertime,
  recommendedMinutes,
  pdfAllowed,
  resume,
}: {
  /** Saved progress of an unfinished exam ("continue where you left off"). */
  resume?: ExamProgress | null
  /** From /api/exam/start — the grading request must present it. */
  startId?: string | null
  /** Course-group mock: when the time runs out the student may keep going (the clock turns negative). */
  allowOvertime?: boolean
  /** Task: suggested minutes, shown once on the start screen. */
  recommendedMinutes?: number | null
  /** The teacher allowed downloading this mock's questions as a PDF after it is finished. */
  pdfAllowed?: boolean
  modules: TestModule[]
  testTitle: string
  scoringMode: ScoringMode
  singleSubjectKind?: SectionKind
  timerMode: TimerMode
  /** Admin "Check it now": no timer, free module switching, block-layout editing, publish. */
  preview?: { published: boolean }
}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [moduleIdx, setModuleIdx] = useState(resume?.moduleIdx ?? 0)
  const [phase, setPhase] = useState<Phase>(preview ? 'testing' : (resume?.phase ?? 'moduleIntro'))
  const [current, setCurrent] = useState(resume?.current ?? 0)
  const [timeLeft, setTimeLeft] = useState(resume ? resume.timeLeft : timerMode === 'countdown' ? modules[0].durationSec : 0)
  // Time ran out in a course-group mock: ask once whether to keep going; "yes" → overtime (minus clock).
  const [overtimePrompt, setOvertimePrompt] = useState(false)
  const [overtime, setOvertime] = useState(resume?.overtime ?? false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  // Where the Desmos panel sits — the question text shifts to the right of it.
  const [calcShift, setCalcShift] = useState(CONTENT_SHIFT)
  const [sheetPx, setSheetPx] = useState<number | null>(null)
  // The reference sheet docks on the right — the text shifts left of it.
  const [refShift, setRefShift] = useState(REFERENCE_DEFAULT_WIDTH + REFERENCE_GAP)
  const [referenceOpen, setReferenceOpen] = useState(false)
  const highlightFnRef = useRef<(() => void) | null>(null)
  // Footer height, measured — the mobile calculator sheet sits right above it.
  const footerRef = useRef<HTMLDivElement>(null)
  const [footerH, setFooterH] = useState(0)
  useEffect(() => {
    const el = footerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setFooterH(el.offsetHeight))
    ro.observe(el)
    setFooterH(el.offsetHeight)
    return () => ro.disconnect()
  }, [phase])

  const [answers, setAnswers] = useState<Record<string, string>>(resume?.answers ?? {})
  const [flags, setFlags] = useState<Record<string, boolean>>(resume?.flags ?? {})
  const [eliminated, setEliminated] = useState<Record<string, ChoiceId[]>>((resume?.eliminated as Record<string, ChoiceId[]>) ?? {})

  // Server grading: answer keys arrive only after submitting.
  const [keys, setKeys] = useState<Record<string, AnswerKey>>({})
  const [gradeState, setGradeState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [gradeError, setGradeError] = useState<string | null>(null)
  const [videoReady, setVideoReady] = useState(false)
  // The score exactly as the server computed and saved it.
  const [serverScore, setServerScore] = useState<{ rw: SectionResult; math: SectionResult; composite: number } | null>(null)
  const [startedAt] = useState(() => Date.now() - (resume?.elapsedMs ?? 0))
  const [finishedAt, setFinishedAt] = useState<number | null>(null)

  /* ---------------- pace: how long each question really held the student ---------------- */
  const paceRef = useRef<Record<string, number>>({ ...(resume?.pace ?? {}) })
  const [wallSec, setWallSec] = useState<number | null>(null)
  const paceTick = useStableCallback(() => {
    if (preview || phase !== 'testing' || document.visibilityState !== 'visible') return
    const m = modules[moduleIdx]
    if (!m) return
    const k = keyFor(m.id, current)
    paceRef.current[k] = (paceRef.current[k] ?? 0) + 1
  })
  useEffect(() => {
    const id = setInterval(() => paceTick(), 1000)
    return () => clearInterval(id)
  }, [paceTick])

  /* ----------------------------- admin preview ----------------------------- */
  const [published, setPublished] = useState(preview?.published ?? true)
  const [editMode, setEditMode] = useState(false)
  // Saved (this session) and not-yet-saved layout edits, keyed by question id.
  const [savedEdits, setSavedEdits] = useState<Record<string, LayoutEdit>>({})
  const [edits, setEdits] = useState<Record<string, LayoutEdit>>({})
  const [savingLayout, setSavingLayout] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [previewMsg, setPreviewMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const dirtyCount = Object.keys(edits).length

  useEffect(() => {
    if (!previewMsg) return
    const t = setTimeout(() => setPreviewMsg(null), 4000)
    return () => clearTimeout(t)
  }, [previewMsg])

  useEffect(() => {
    if (!preview || dirtyCount === 0) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [preview, dirtyCount])

  async function saveLayouts(): Promise<boolean> {
    const items = Object.entries(edits).map(([id, e]) => ({ id, prompt: e.prompt, layout: e.layout }))
    if (items.length === 0) return true
    setSavingLayout(true)
    try {
      const res = await fetch('/api/admin/questions/batch-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPreviewMsg({ ok: false, text: data.error ?? 'Saqlashda xatolik.' })
        return false
      }
      setSavedEdits((m) => ({ ...m, ...edits }))
      setEdits({})
      setPreviewMsg({ ok: true, text: `Saqlandi — ${items.length} ta savol` })
      return true
    } catch {
      setPreviewMsg({ ok: false, text: "Server bilan bog'lanib bo'lmadi." })
      return false
    } finally {
      setSavingLayout(false)
    }
  }

  async function togglePublish() {
    const next = !published
    if (next && dirtyCount > 0) {
      const ok = await saveLayouts()
      if (!ok) return
    }
    setPublishing(true)
    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testLabel: testTitle, published: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPreviewMsg({ ok: false, text: data.error ?? 'Xatolik.' })
        return
      }
      setPublished(next)
      setPreviewMsg({
        ok: true,
        text: next ? "Publish qilindi — o'quvchilarga ko'rinadi" : 'Draftga qaytarildi — yashirin',
      })
    } catch {
      setPreviewMsg({ ok: false, text: "Server bilan bog'lanib bo'lmadi." })
    } finally {
      setPublishing(false)
    }
  }

  const activeModule = modules[moduleIdx]
  const baseQuestion = useMemo(() => questionAt(activeModule, current), [activeModule, current])
  // Warm the browser cache with the next questions' figures, so they appear at once when the student moves on.
  useEffect(() => {
    for (let i = current + 1; i <= current + 3 && i < activeModule.total; i++) {
      const q = questionAt(activeModule, i)
      const srcs = [q.image, ...(q.choices ?? []).map((c) => c.image)].filter((x): x is string => !!x)
      for (const src of srcs) {
        if (PREFETCHED.has(src)) continue
        PREFETCHED.add(src)
        const img = new Image()
        img.decoding = 'async'
        img.src = src
      }
    }
  }, [activeModule, current])
  const question = useMemo(() => {
    const id = baseQuestion.id
    if (!id) return baseQuestion
    const e = edits[id] ?? savedEdits[id]
    return e ? { ...baseQuestion, prompt: e.prompt, layout: e.layout } : baseQuestion
  }, [baseQuestion, edits, savedEdits])
  const qKey = keyFor(activeModule.id, current)

  // Admin preview: the correct answer of the question on screen, and how many questions of the whole mock have none.
  const hasKey = (q: Question) => (q.type === 'gridin' ? !!q.correctValue?.trim() : !!q.correct)
  const previewAnswer = preview
    ? hasKey(baseQuestion)
      ? { text: baseQuestion.type === 'gridin' ? baseQuestion.correctValue!.trim() : baseQuestion.correct!, missing: false }
      : { text: 'kiritilmagan', missing: true }
    : undefined
  const missingKeys = preview ? modules.reduce((n, m) => n + m.pool.filter((q) => !hasKey(q)).length, 0) : 0

  // Computed once per change of answers/flags (not on every timer tick) so the footer can stay memoised.
  const { answeredMap, flaggedMap } = useMemo(() => {
    const a: Record<number, boolean> = {}
    const f: Record<number, boolean> = {}
    for (let i = 0; i < activeModule.total; i++) {
      const k = keyFor(activeModule.id, i)
      a[i] = !!answers[k]
      f[i] = !!flags[k]
    }
    return { answeredMap: a, flaggedMap: f }
  }, [answers, flags, activeModule])

  // Timer — counts down for normal tests, counts up (stopwatch, never auto-submits) for course tasks.
  // Course-group mocks: at 00:00 the clock stops and asks; "continue" keeps counting into minus time.
  useEffect(() => {
    if (phase !== 'testing' || preview) return
    if (timerMode === 'countdown' && timeLeft <= 0 && !overtime) {
      if (allowOvertime) {
        if (!overtimePrompt) setOvertimePrompt(true)
        return
      }
      finishModule()
      return
    }
    if (overtimePrompt) return
    const t = setInterval(() => {
      setTimeLeft((s) => (timerMode === 'countdown' ? (overtime ? s - 1 : Math.max(0, s - 1)) : s + 1))
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft, timerMode, overtime, overtimePrompt])

  // Computed once the exam reaches the report phase — shared by the on-screen
  // result screen and the background submission to /api/results below.
  // Groups by each module's own `kind` rather than a fixed position, so this
  // works for full tests (2 reading + 2 math), single-subject tests (2 of one
  // kind), and practice/course-task sets (however many modules of one kind).
  const results = useMemo(() => {
    const readingModules = modules.filter((m) => m.kind === 'reading')
    const mathModules = modules.filter((m) => m.kind === 'math')

    function tally(sectionModules: TestModule[]) {
      let correct = 0
      let incorrect = 0
      let omitted = 0
      let total = 0
      const review: ReviewItem[] = []
      for (const mod of sectionModules) {
        for (let i = 0; i < mod.total; i++) {
          const base = questionAt(mod, i)
          const q = base.id && keys[base.id] ? { ...base, ...keys[base.id] } : base
          const k = keyFor(mod.id, i)
          const answer = answers[k]
          total++
          if (!answer) {
            omitted++
            review.push({
              moduleLabel: mod.shortLabel,
              sectionKind: mod.kind,
              index: i,
              question: q,
              correct: false,
              omitted: true,
            })
            continue
          }
          const ok = isCorrectAnswer(q, answer)
          if (ok) correct++
          else incorrect++
          review.push({
            moduleLabel: mod.shortLabel,
            sectionKind: mod.kind,
            index: i,
            question: q,
            answer,
            correct: ok,
            omitted: false,
          })
        }
      }
      return { correct, incorrect, omitted, total, review }
    }

    const rwTally = tally(readingModules)
    const mathTally = tally(mathModules)
    const rw = buildSectionResult(rwTally.correct, rwTally.incorrect, rwTally.omitted, rwTally.total)
    const math = buildSectionResult(mathTally.correct, mathTally.incorrect, mathTally.omitted, mathTally.total)
    const composite = singleSubjectKind === 'math' ? math.scaled : singleSubjectKind === 'reading' ? rw.scaled : rw.scaled + math.scaled

    // Flat, position-ordered review used by the unscored practice result screen.
    const practiceReview: PracticeReviewItem[] = [...rwTally.review, ...mathTally.review].map((r, i) => ({
      index: i,
      question: r.question,
      answer: r.answer,
      correct: r.correct,
      omitted: r.omitted,
    }))

    return { rw, math, composite, rwTally, mathTally, practiceReview }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, keys])

  // Once the exam is over, the server grades it (and saves the attempt for
  // scored tests). Only then do the answer keys / explanations arrive.
  async function submitForGrading() {
    setGradeState('loading')
    setGradeError(null)
    const items: Record<string, unknown>[] = []
    for (const mod of [...modules.filter((m) => m.kind === 'reading'), ...modules.filter((m) => m.kind === 'math')]) {
      for (let i = 0; i < mod.total; i++) {
        const q = questionAt(mod, i)
        const answer = answers[keyFor(mod.id, i)]
        items.push({
          qid: q.id,
          answer,
        })
      }
    }
    const elapsedMin = Math.round(((finishedAt ?? Date.now()) - startedAt) / 60000)
    try {
      const res = await fetch('/api/exam/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startId: startId ?? null,
          testLabel: testTitle,
          elapsedLabel: `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m`,
          items,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGradeError(data.error ?? 'Natijani hisoblab bo‘lmadi.')
        setGradeState('error')
        return
      }
      setKeys(data.keys ?? {})
      if (data.rw && data.math) setServerScore({ rw: data.rw, math: data.math, composite: data.composite })
      setWallSec(typeof data.wallSec === 'number' ? data.wallSec : null)
      setGradeState('done')
      if (scoringMode !== 'practice' && data.rw && data.math) {
        try {
          const sc = Number(data.rw.scaled) + Number(data.math.scaled)
          sessionStorage.setItem('sd-celebrate', JSON.stringify({ label: testTitle, score: sc, outOf: 1600 }))
        } catch {
          /* ignore */
        }
      }
      // A video analysis is offered right under the score, when one exists.
      fetch(`/api/video?test=${encodeURIComponent(testTitle)}`)
        .then((r) => setVideoReady(r.ok))
        .catch(() => {})
    } catch {
      setGradeError("Server bilan bog'lanib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.")
      setGradeState('error')
    }
  }

  // While the result is being sent, closing the tab would lose it — ask first.
  useEffect(() => {
    if (gradeState !== 'loading') return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [gradeState])

  useEffect(() => {
    if (phase !== 'report' || preview || gradeState !== 'idle') return
    submitForGrading()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  /* ------------------- "continue where you left off" ------------------- */
  // The exam writes its state to the student's open start: once ~20 s after a change, right away when a
  // module changes, and when the page is hidden/closed. Reads nothing back until the exam is opened again.
  const snapRef = useRef<ExamProgress | null>(null)
  const dirtyRef = useRef(false)
  const lastSaveRef = useRef(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopSavingRef = useRef(false)
  stopSavingRef.current = gradeState === 'done' || gradeState === 'loading'
  if (!preview && startId && phase !== 'moduleIntro') {
    let answered = 0
    let total = 0
    for (const m of modules) {
      total += m.total
      for (let i = 0; i < m.total; i++) if (answers[keyFor(m.id, i)]) answered++
    }
    snapRef.current = {
      v: 1,
      moduleIdx,
      phase: phase as ExamProgress['phase'],
      current,
      timeLeft,
      overtime,
      elapsedMs: Date.now() - startedAt,
      answers,
      flags,
      eliminated,
      pace: { ...paceRef.current },
      answered,
      total,
      moduleLabel: modules[moduleIdx]?.label ?? '',
    }
  }
  const flushProgress = useStableCallback(() => {
    if (preview || !startId || stopSavingRef.current || !snapRef.current) return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    dirtyRef.current = false
    lastSaveRef.current = Date.now()
    try {
      fetch('/api/exam/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startId, progress: snapRef.current }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      /* saving is best-effort */
    }
  })
  // Answers / flags / position changed → save soon (at most one write per ~20 s).
  useEffect(() => {
    if (preview || !startId || phase === 'moduleIntro') return
    dirtyRef.current = true
    if (saveTimerRef.current) return
    const wait = Math.max(1500, 20_000 - (Date.now() - lastSaveRef.current))
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      if (dirtyRef.current) flushProgress()
    }, wait)
  }, [answers, flags, eliminated, current, preview, startId, phase, flushProgress])
  // A new module / break / report → save right away.
  useEffect(() => {
    if (preview || !startId || phase === 'moduleIntro') return
    flushProgress()
  }, [moduleIdx, phase, preview, startId, flushProgress])
  // Tab hidden or closed → save what the timer shows now.
  useEffect(() => {
    if (preview || !startId) return
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushProgress()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flushProgress)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flushProgress)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [preview, startId, flushProgress])

  const selectAnswer = useStableCallback((value: string) => {
    setAnswers((a) => ({ ...a, [qKey]: value }))
  })

  const toggleFlag = useStableCallback(() => {
    setFlags((f) => ({ ...f, [qKey]: !f[qKey] }))
  })

  const toggleEliminate = useStableCallback((id: ChoiceId) => {
    setEliminated((e) => {
      const current = e[qKey] ?? []
      const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
      return { ...e, [qKey]: next }
    })
  })

  const goNext = useStableCallback(() => {
    if (current < activeModule.total - 1) {
      setCurrent((c) => c + 1)
    } else {
      finishModule()
    }
  })

  const goBack = useStableCallback(() => {
    setCurrent((c) => Math.max(0, c - 1))
  })

  const onLayoutEdit = useStableCallback((edit: LayoutEdit) => {
    const id = baseQuestion.id
    if (id) setEdits((m) => ({ ...m, [id]: edit }))
  })

  const registerHighlight = useStableCallback((fn: (() => void) | null) => {
    highlightFnRef.current = fn
  })

  /** Directly begins a given module index: resets timer/question and starts testing. */
  function startModule(idx: number) {
    setCalculatorOpen(false)
    setReferenceOpen(false)
    setModuleIdx(idx)
    setCurrent(0)
    setOvertime(false)
    setOvertimePrompt(false)
    setTimeLeft(timerMode === 'countdown' ? modules[idx].durationSec : 0)
    setPhase('testing')
  }

  function finishModule() {
    if (preview) {
      // Preview never scores or breaks — just walk on to the next module.
      if (moduleIdx < modules.length - 1) startModule(moduleIdx + 1)
      else setPreviewMsg({ ok: true, text: 'Bu oxirgi savol' })
      return
    }
    setCalculatorOpen(false)
    setReferenceOpen(false)
    setOvertimePrompt(false)
    const isLastModule = moduleIdx === modules.length - 1

    if (isLastModule) {
      setFinishedAt(Date.now())
      setPhase('report')
      return
    }

    if (modules.length === 4 && moduleIdx === 1) {
      // Full test, Reading & Writing finished — mandatory longer break before Math.
      setPhase('break')
      return
    }

    // First module of a pair just finished: auto-advance after a short
    // countdown, with the option to take a break.
    setPhase('autoNext')
  }

  function exitExam() {
    if (preview) {
      if (dirtyCount > 0 && !confirm("Saqlanmagan o'zgarishlar bor. Baribir chiqasizmi?")) return
      // Back to the admin tab that opened this preview (its URL is secret,
      // so it is never written into this public page).
      if (window.history.length > 1) window.history.back()
      else {
        window.close()
        setTimeout(() => router.push('/dashboard'), 300)
      }
      return
    }
    const msg =
      timerMode === 'countup'
        ? "Vazifadan chiqasizmi? Javoblaringiz 7 kun saqlanadi, bosh sahifadan davom ettirasiz."
        : 'Exit the practice test? Your progress is saved for 7 days — continue from the dashboard.'
    if (confirm(msg)) {
      flushProgress()
      router.push('/dashboard')
    }
  }

  /* ------------------------------ Transitions ------------------------------ */

  if (phase === 'moduleIntro') {
    const subtitle =
      modules.length === 4
        ? 'You will complete two Reading and Writing modules, a short break, then two Math modules. Each module is timed.'
        : modules.length === 2
          ? `Siz ${modules[0].kind === 'math' ? 'Math' : 'Reading and Writing'} bo'yicha 2 modulni bajarasiz. Har bir modul vaqt bilan cheklangan.`
          : timerMode === 'countup'
            ? "Bu vazifada vaqt cheklovi yo'q — taymer yuqoriga sanaydi, qancha vaqt ketganini ko'rib turasiz. O'zingiz tayyor bo'lganda yakunlaysiz."
            : "Siz bir qator savolni bajarasiz. Vaqt tugaganda modul avtomatik yakunlanadi."
    return (
      <TransitionScreen
        variant="start"
        title={testTitle}
        subtitle={subtitle}
        badge={timerMode === 'countup' && recommendedMinutes ? `Tavsiya etilgan vaqt: ${recommendedMinutes} daqiqa` : undefined}
        onContinue={() => startModule(0)}
      />
    )
  }

  if (phase === 'autoNext') {
    const nextIdx = moduleIdx + 1
    return <TransitionScreen variant="autoNext" onProceed={() => startModule(nextIdx)} />
  }

  if (phase === 'break') {
    const nextIdx = moduleIdx + 1
    const isBigBreak = modules.length === 4 && moduleIdx === 1
    return (
      <TransitionScreen
        variant="break"
        breakSeconds={isBigBreak ? BIG_BREAK_SECONDS : SHORT_BREAK_SECONDS}
        title={isBigBreak ? 'All Your Work Is Saved' : 'Dam olish vaqti'}
        subtitle={
          isBigBreak
            ? "You've completed the Reading and Writing section. Take a short break before starting the Math section."
            : `Keyingi modul: ${modules[nextIdx].label}. Tayyor bo'lganingizda davom eting.`
        }
        onContinue={() => startModule(nextIdx)}
      />
    )
  }

  if (phase === 'report' && gradeState !== 'done') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-[#f8fafc] px-6 text-center text-[#0f172a]">
        {gradeState === 'error' ? (
          <>
            <p className="max-w-sm text-sm font-semibold text-red-600">{gradeError}</p>
            <button
              type="button"
              onClick={submitForGrading}
              className="rounded-lg bg-[#0e7c75] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0b4f4a]"
            >
              Qayta urinish
            </button>
          </>
        ) : (
          <>
            <SatLoader variant="results" fullscreen={false} theme="light" label="Natijalar hisoblanmoqda va yuborilmoqda…" />
            <p className="max-w-xs text-sm text-[#475569]">Iltimos, oynani yopmang va sahifani yangilamang. Bu bir necha soniya oladi.</p>
          </>
        )}
      </div>
    )
  }

  const videoHref = `/dashboard/analysis?test=${encodeURIComponent(testTitle)}`
  // The PDF is offered only to students who really worked through the test (not flipped to the end).
  const paceOk = !!preview || paceVerdict(paceRef.current, modules.map((m) => ({ id: m.id, kind: m.kind, total: m.total })), keyFor, wallSec).ok
  const pdfOpen = !!pdfAllowed && paceOk
  const pdfLocked = !!pdfAllowed && !paceOk

  if (phase === 'report') {
    const elapsedMs = (finishedAt ?? Date.now()) - startedAt
    const elapsedMin = Math.round(elapsedMs / 60000)
    const elapsedLabel = `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m`

    if (scoringMode === 'practice') {
      return (
        <PracticeResultScreen
          testTitle={testTitle}
          elapsedLabel={elapsedLabel}
          review={results.practiceReview}
          videoHref={videoReady ? videoHref : undefined}
          pdfAllowed={pdfOpen}
          pdfLocked={pdfLocked}
        />
      )
    }

    return (
      <ScoreReport
        studentName={USER_NAME}
        testTitle={testTitle}
        composite={(serverScore?.rw ?? results.rw).scaled + (serverScore?.math ?? results.math).scaled}
        rw={serverScore?.rw ?? results.rw}
        math={serverScore?.math ?? results.math}
        elapsedLabel={elapsedLabel}
        review={[...results.rwTally.review, ...results.mathTally.review]}
        outOf={1600}
        singleSection={scoringMode === 'single' ? singleSubjectKind : undefined}
        showCertificateButton
        videoHref={videoReady ? videoHref : undefined}
        pdfAllowed={pdfOpen}
        pdfLocked={pdfLocked}
      />
    )
  }

  /* -------------------------------- Testing -------------------------------- */

  return (
    <div className={`exam-text flex h-dvh flex-col overflow-hidden ${activeModule.kind === 'math' ? 'bg-[#f8fafc]' : 'bg-white'}`}>
      {preview && (
        <PreviewBar
          published={published}
          modules={modules.map((m) => ({ id: m.id, label: m.shortLabel }))}
          moduleIdx={moduleIdx}
          onModuleChange={(i) => startModule(i)}
          editMode={editMode}
          onToggleEdit={() => setEditMode((v) => !v)}
          canEdit={!!baseQuestion.id}
          dirtyCount={dirtyCount}
          currentDirty={!!(baseQuestion.id && edits[baseQuestion.id])}
          onDiscardCurrent={() => {
            const id = baseQuestion.id
            if (!id) return
            setEdits((m) => {
              const next = { ...m }
              delete next[id]
              return next
            })
          }}
          onResetCurrent={() => {
            const id = baseQuestion.id
            if (!id) return
            setEdits((m) => ({ ...m, [id]: { prompt: question.prompt, layout: null } }))
          }}
          saving={savingLayout}
          onSave={saveLayouts}
          publishing={publishing}
          onTogglePublish={togglePublish}
          answer={previewAnswer}
          missingKeys={missingKeys}
          onBack={exitExam}
          message={previewMsg}
        />
      )}
      <ExamHeader
        label={activeModule.label}
        seconds={timeLeft}
        countUp={timerMode === 'countup'}
        overtime={overtime}
        mathTools={activeModule.kind === 'math'}
        calculatorOpen={calculatorOpen}
        referenceOpen={referenceOpen}
        onToggleCalculator={() => setCalculatorOpen((o) => !o)}
        onToggleReference={() => setReferenceOpen((o) => !o)}
        onHighlight={() => highlightFnRef.current?.()}
        onExit={exitExam}
      />

      <div
        className="relative flex min-h-0 flex-1 transition-[margin-left,margin-right] duration-700 ease-[cubic-bezier(.4,0,.2,1)]"
        style={{
          marginLeft: calculatorOpen && !isMobile ? calcShift : 0,
          marginRight: referenceOpen && !isMobile ? refShift : 0,
          // Mobile: the calculator sheet covers the lower part of the screen —
          // shrink the question's scroll area to what's still visible, so the
          // student can scroll every answer choice into view above it.
          paddingBottom: isMobile && referenceOpen ? '60dvh' : calculatorOpen && isMobile ? (sheetPx ?? MOBILE_SHEET_HEIGHT) : 0,
        }}
      >
        {/* "Xatosi bormi?" — left edge of the question area (computer), follows the calculator when it docks. Same for students and the admin preview. */}
        <div className="absolute left-0 top-1/3 z-20">
          <ReportQuestionButton
            variant="tab"
            // The first 3 questions of the test: glow for ~5 s on arrival so the student finds the tab.
            pulse={moduleIdx === 0 && current < 3}
            testLabel={testTitle}
            moduleLabel={activeModule.shortLabel}
            qNumber={current + 1}
            question={baseQuestion}
          />
        </div>
        <main className="min-h-0 min-w-0 flex-1">
          <QuestionView
            module={activeModule}
            index={current}
            question={question}
            selected={answers[qKey]}
            eliminated={eliminated[qKey] ?? NO_CHOICES}
            flagged={!!flags[qKey]}
            onSelect={selectAnswer}
            onToggleEliminate={toggleEliminate}
            onToggleFlag={toggleFlag}
            compact={(calculatorOpen || referenceOpen) && isMobile}
            editLayout={!!preview && editMode && !!baseQuestion.id}
            onLayoutEdit={onLayoutEdit}
            registerHighlightTrigger={registerHighlight}
          />
        </main>
        {/* faint "satbyusmon.com" over the question area — screenshots keep pointing to the site */}
        <ExamWatermark {...(isMobile ? { fontSize: 18, gapX: 90, gapY: 80 } : {})} />
      </div>

      {/* Floating, draggable, always-mounted calculator — never re-inits Desmos */}
      <CalculatorPanel
        onSheetHeightChange={setSheetPx}
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        bottomOffset={footerH}
        onRectChange={({ x, width }) =>
          // Docked (near the left edge): push the text past it. Dragged far
          // away: leave the text where it is.
          setCalcShift(x < 80 ? Math.min(x + width + PANEL_LEFT_GAP, Math.round(window.innerWidth * 0.6)) : 0)
        }
      />

      <ReferenceSheet
        open={referenceOpen}
        onClose={() => setReferenceOpen(false)}
        bottomOffset={footerH}
        onWidthChange={(w) => setRefShift(w + REFERENCE_GAP)}
      />

      {overtimePrompt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl" role="alertdialog" aria-modal="true">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-amber-50 text-3xl">⏰</div>
            <h3 className="text-lg font-extrabold text-[#0f172a]">Vaqt tugadi</h3>
            <p className="mt-1.5 text-sm text-[#475569]">
              Ishlashni davom ettirishni xohlaysizmi? Davom etsangiz, test yopilmaydi — taymer minus vaqtga qarab sanaydi va
              qancha ortiqcha vaqt ketganini ko&apos;rasiz. O&apos;zingiz tayyor bo&apos;lganda yakunlaysiz.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setOvertime(true)
                  setOvertimePrompt(false)
                }}
                className="h-11 flex-1 rounded-xl bg-[#0e7c75] text-sm font-bold text-white hover:bg-[#0a625c]"
              >
                Davom etish
              </button>
              <button
                type="button"
                onClick={finishModule}
                className="h-11 flex-1 rounded-xl border border-[#e2e8f0] text-sm font-bold text-[#475569] hover:border-red-300 hover:text-red-600"
              >
                Yakunlash
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={footerRef} className="shrink-0">
      <ExamFooter
        current={current}
        total={activeModule.total}
        sectionLabel={activeModule.label}
        userName={USER_NAME}
        answered={answeredMap}
        flagged={flaggedMap}
        onNavigate={setCurrent}
        onBack={goBack}
        onNext={goNext}
        nextLabel={current >= activeModule.total - 1 ? 'Submit Module' : 'Next'}
      />
      </div>
    </div>
  )
}

function splitHalves<T>(arr: T[]): [T[], T[]] {
  if (arr.length === 0) return [[], []]
  if (arr.length === 1) return [arr, arr]
  const mid = Math.ceil(arr.length / 2)
  return [arr.slice(0, mid), arr.slice(mid)]
}

/**
 * Fetches one section's questions for a dedicated test, split into its two
 * modules. Modern tests (imported via the admin panel's per-module import)
 * are tagged with module_number in the database, so this asks the API for
 * exactly Module 1's and Module 2's own rows — stable and independent of
 * insertion order. A legacy test imported before that tagging existed has
 * no module_number on any of its rows, so both requests come back empty;
 * in that case this falls back to the old behavior (fetch everything,
 * split the insertion-ordered list in half on the client).
 */
async function fetchModuleAware(kind: SectionKind, testLabel: string, withKeys = false): Promise<[Question[], Question[]]> {
  // ONE request per section (it used to be one per module + a fallback): the server sends every
  // row of the test with its `moduleNumber`, we split here. Fewer requests = a much faster start.
  // withKeys: only the admin's "Check it now" asks for the answer keys (the server ignores it for anyone else).
  const res = await fetch(`/api/questions?kind=${kind}&test=${encodeURIComponent(testLabel)}${withKeys ? '&keys=1' : ''}`).then((r) => r.json())
  const all: Question[] = res.questions ?? []
  const m1 = all.filter((q) => q.moduleNumber === 1)
  const m2 = all.filter((q) => q.moduleNumber === 2)
  if (m1.length > 0 || m2.length > 0) return [m1, m2]
  // Legacy test imported before module numbers existed: split the insertion-ordered list in half.
  return splitHalves<Question>(all)
}

/** Builds a 4-module full test (Reading&Writing + Math) from a dedicated test's own, already-split modules. */
function buildFullModules(r1: Question[], r2: Question[], m1: Question[], m2: Question[], mins: [number, number, number, number]): TestModule[] | null {
  if (r1.length + r2.length === 0 || m1.length + m2.length === 0) return null
  return [
    { id: 'rw-1', kind: 'reading', label: 'Section 1, Module 1: Reading and Writing', shortLabel: 'Reading and Writing — Module 1', durationSec: mins[0] * 60, total: Math.min(27, r1.length), pool: r1 },
    { id: 'rw-2', kind: 'reading', label: 'Section 1, Module 2: Reading and Writing', shortLabel: 'Reading and Writing — Module 2', durationSec: mins[1] * 60, total: Math.min(27, r2.length), pool: r2 },
    { id: 'math-1', kind: 'math', label: 'Section 2, Module 1: Math', shortLabel: 'Math — Module 1', durationSec: mins[2] * 60, total: Math.min(22, m1.length), pool: m1 },
    { id: 'math-2', kind: 'math', label: 'Section 2, Module 2: Math', shortLabel: 'Math — Module 2', durationSec: mins[3] * 60, total: Math.min(22, m2.length), pool: m2 },
  ]
}

/** Builds a 2-module single-subject scored test (Math-only or R&W-only, 200-800 scale) from already-split modules. */
function buildSingleScoredModules(kind: SectionKind, p1: Question[], p2: Question[], mins: [number, number]): TestModule[] | null {
  if (p1.length + p2.length === 0) return null
  const cap = kind === 'math' ? 22 : 27
  const label = kind === 'math' ? 'Math' : 'Reading and Writing'
  return [
    { id: `${kind}-1`, kind, label: `Module 1: ${label}`, shortLabel: `${label} — Module 1`, durationSec: mins[0] * 60, total: Math.min(cap, p1.length), pool: p1 },
    { id: `${kind}-2`, kind, label: `Module 2: ${label}`, shortLabel: `${label} — Module 2`, durationSec: mins[1] * 60, total: Math.min(cap, p2.length), pool: p2 },
  ]
}

/** Builds a single-module unscored practice set (any question count) — used for
 *  both "erkin mashq" and Course Tasks (the latter with a count-up timer instead). */
function buildPracticeModule(kind: SectionKind, questions: Question[], minutes: number): TestModule[] | null {
  if (questions.length === 0) return null
  const label = kind === 'math' ? 'Math' : 'Reading and Writing'
  return [
    { id: `${kind}-practice`, kind, label, shortLabel: label, durationSec: minutes * 60, total: questions.length, pool: questions },
  ]
}

/** Builds a single, continuous SCORED module (no module break), numbered straight
 *  through 1..44 on screen — the "ketma-ket 44 talik" Math mock layout. */
function buildSequentialScoredModule(kind: SectionKind, questions: Question[], totalMinutes: number): TestModule[] | null {
  if (questions.length === 0) return null
  const cap = kind === 'math' ? 44 : 54
  const label = kind === 'math' ? 'Math' : 'Reading and Writing'
  return [
    { id: `${kind}-seq`, kind, label, shortLabel: label, durationSec: totalMinutes * 60, total: Math.min(cap, questions.length), pool: questions },
  ]
}

/** Figures already requested in this tab (prefetch each once). */
const PREFETCHED = new Set<string>()

type LoadError = { message: string; href?: string; hrefLabel?: string }

/** Registers the start of a mock (daily/hourly limits) before any question is fetched. */
async function startExam(testLabel: string | null): Promise<{ startId: string | null; progress: ExamProgress | null } | LoadError> {
  try {
    const res = await fetch('/api/exam/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testLabel }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) {
      return { message: 'Mock yechish uchun avval tizimga kiring.', href: '/login', hrefLabel: 'Kirish' }
    }
    if (res.status === 403 && data.code === 'COURSE') {
      return { message: data.error ?? 'Bu vazifa faqat kurs o‘quvchilari uchun.', href: '/dashboard/course-tasks', hrefLabel: 'Kurslarga o‘tish' }
    }
    if (res.status === 402) {
      return { message: data.error ?? 'Bu mock pullik.', href: '/dashboard/free-mocks', hrefLabel: 'Free Mocklarga qaytish' }
    }
    if (!res.ok) {
      return { message: data.error ?? 'Testni boshlab bo‘lmadi.', href: '/dashboard/practice', hrefLabel: 'Mocklarga qaytish' }
    }
    return { startId: data.startId ?? null, progress: (data.progress as ExamProgress | null) ?? null }
  } catch {
    return { message: "Server bilan bog'lanib bo'lmadi. Internet aloqasini tekshiring." }
  }
}

type LoadedExam = {
  startId?: string | null
  resume?: ExamProgress | null
  /** Set only for an admin opening ?preview=1 ("Check it now"). */
  preview?: { published: boolean }
  modules: TestModule[]
  scoringMode: ScoringMode
  singleSubjectKind?: SectionKind
  timerMode: TimerMode
  allowOvertime?: boolean
  recommendedMinutes?: number | null
  pdfAllowed?: boolean
}

function PageInner() {
  const searchParams = useSearchParams()
  const testParam = searchParams.get('test')
  const previewParam = searchParams.get('preview') === '1'

  const [ready, setReady] = useState(false)
  const [loaded, setLoaded] = useState<LoadedExam | null>(null)
  const [loadError, setLoadError] = useState<LoadError | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (testParam) {
        try {
          const [configRes, adminRes] = await Promise.all([
            fetch(`/api/admin/test-config?testLabel=${encodeURIComponent(testParam)}`).then((r) => r.json()),
            previewParam
              ? fetch('/api/admin/check').then((r) => r.json()).catch(() => ({ admin: false }))
              : Promise.resolve({ admin: false }),
          ])
          if (cancelled) return
          const preview = adminRes.admin ? { published: configRes.config?.published ?? true } : undefined

          // Students: count this start against the limits before loading questions.
          let startId: string | null = null
          let savedProgress: ExamProgress | null = null
          if (!preview) {
            const started = await startExam(testParam)
            if (cancelled) return
            if ('message' in started) {
              setLoadError(started)
              return
            }
            startId = started.startId
            savedProgress = started.progress
          }

          const config: TestConfig | null = configRes.config ?? null
          const subject = config?.subject ?? 'full'
          const scored = config?.scored ?? true
          const placement = config?.placement ?? 'mock'
          const englishMinutes = config?.englishModuleMinutes ?? 32
          const mathMinutes = config?.mathModuleMinutes ?? 35
          const mathLayout = config?.mathLayout ?? 'modules'
          // Minutes per module: the admin's own numbers (new-mock form) win over the old per-subject pair.
          const mm = config?.moduleMinutes ?? null
          const rwMins: [number, number] = [mm?.rw1 ?? englishMinutes, mm?.rw2 ?? mm?.rw1 ?? englishMinutes]
          const mathMins: [number, number] = [mm?.m1 ?? mathMinutes, mm?.m2 ?? mm?.m1 ?? mathMinutes]
          const isCourseTask = placement === 'course_task'

          let built: TestModule[] | null = null
          let scoringMode: ScoringMode = 'full'
          let singleSubjectKind: SectionKind | undefined
          const timerMode: TimerMode = isCourseTask ? 'countup' : 'countdown'

          if (subject === 'full') {
            const [[r1, r2], [m1, m2]] = await Promise.all([
              fetchModuleAware('reading', testParam, !!preview),
              fetchModuleAware('math', testParam, !!preview),
            ])
            if (cancelled) return
            built = buildFullModules(r1, r2, m1, m2, [rwMins[0], rwMins[1], mathMins[0], mathMins[1]])
            scoringMode = 'full'
          } else {
            singleSubjectKind = subject === 'math' ? 'math' : 'reading'
            const minutes = subject === 'math' ? mathMinutes : englishMinutes

            if (isCourseTask || !scored) {
              const flatRes = await fetch(
                `/api/questions?kind=${singleSubjectKind}&test=${encodeURIComponent(testParam)}${preview ? '&keys=1' : ''}`,
              ).then((r) => r.json())
              if (cancelled) return
              built = buildPracticeModule(singleSubjectKind, flatRes.questions ?? [], minutes)
              scoringMode = 'practice'
            } else if (singleSubjectKind === 'math' && mathLayout === 'sequential') {
              const flatRes = await fetch(`/api/questions?kind=math&test=${encodeURIComponent(testParam)}${preview ? '&keys=1' : ''}`).then((r) => r.json())
              if (cancelled) return
              built = buildSequentialScoredModule('math', flatRes.questions ?? [], mm?.seq ?? minutes * 2)
              scoringMode = 'single'
            } else {
              const [p1, p2] = await fetchModuleAware(singleSubjectKind, testParam, !!preview)
              if (cancelled) return
              built = buildSingleScoredModules(singleSubjectKind, p1, p2, singleSubjectKind === 'math' ? mathMins : rwMins)
              scoringMode = 'single'
            }
          }

          if (!built) {
            setLoadError({
              message:
                configRes.config?.published === false && !preview
                  ? "Bu test hali e'lon qilinmagan."
                  : 'Bu test uchun hali yetarli savol yuklanmagan.',
            })
          } else {
            // Saved progress only fits if the test still has that module (the teacher may have changed it).
            const resume = savedProgress && savedProgress.moduleIdx < built.length ? savedProgress : null
            setLoaded({
              resume,
              modules: built,
              scoringMode,
              singleSubjectKind,
              timerMode,
              preview,
              startId,
              // A timed mock the teacher put into a course group may be continued past 00:00.
              allowOvertime: !isCourseTask && (config?.courseGroups?.length ?? 0) > 0,
              recommendedMinutes: config?.recommendedMinutes ?? null,
              pdfAllowed: config?.pdfDownload === true || !!preview,
            })
          }
        } catch {
          setLoadError({ message: "Testni yuklab bo'lmadi. Internet aloqasini tekshiring." })
        } finally {
          if (!cancelled) setReady(true)
        }
        return
      }

      // No ?test= → there is no built-in test any more: back to the list.
      window.location.replace('/dashboard/practice')
    }

    load()
    return () => {
      cancelled = true
    }
  }, [testParam, previewParam])

  if (!ready) {
    return (
      <SatLoader variant="exam" theme="light" />
    )
  }

  if (loadError || !loaded) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#f8fafc] text-[#0f172a] px-6">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-sm font-medium">{loadError?.message ?? 'Xatolik yuz berdi.'}</p>
          {loadError?.href && (
            <a
              href={loadError.href}
              className="rounded-lg bg-[#0e7c75] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0b4f4a]"
            >
              {loadError.hrefLabel}
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <ExamEngine
      modules={loaded.modules}
      testTitle={testParam ?? ''}
      scoringMode={loaded.scoringMode}
      singleSubjectKind={loaded.singleSubjectKind}
      timerMode={loaded.timerMode}
      preview={loaded.preview}
      startId={loaded.startId}
      resume={loaded.resume}
      allowOvertime={loaded.allowOvertime}
      recommendedMinutes={loaded.recommendedMinutes}
      pdfAllowed={loaded.pdfAllowed}
    />
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={<SatLoader variant="exam" theme="light" />}
    >
      <PageInner />
    </Suspense>
  )
}
