'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, Delete, Keyboard } from 'lucide-react'
import { Math as MathTex } from '@/components/math'
import { OptionCard } from '@/components/option-card'
import { RichText } from '@/components/rich-text'
import { QuestionImage } from '@/components/question-image'
import { QuestionStimulus, type LayoutEdit } from '@/components/question-stimulus'
import { resolveRows, serializeLayout } from '@/lib/question-layout'
import { useIsMobile } from '@/lib/use-is-mobile'
import type { ChoiceId, Question, TestModule } from '@/lib/test-data'

type QuestionViewProps = {
  module: TestModule
  index: number
  question: Question
  /** Selected choice id (mcq) or raw text (gridin). */
  selected?: string
  eliminated: ChoiceId[]
  flagged: boolean
  onSelect: (value: string) => void
  onToggleEliminate: (id: ChoiceId) => void
  onToggleFlag: () => void
  /** Hands the parent header a function that highlights the current text selection. */
  registerHighlightTrigger?: (fn: (() => void) | null) => void
  /** Mobile with the calculator sheet open: draw everything ~1–2 sizes smaller. */
  compact?: boolean
  /** Admin preview: drag / edit the question's blocks. */
  editLayout?: boolean
  onLayoutEdit?: (edit: LayoutEdit) => void
}

type HlRange = { id: string; start: number; end: number }

/* ------------------------- text-offset helpers ------------------------- */

function textOffset(container: Node, node: Node, offset: number): number | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let total = 0
  let n: Node | null
  while ((n = walker.nextNode())) {
    if (n === node) return total + offset
    total += (n.textContent ?? '').length
  }
  return null
}

/** Reads the live window selection, converts it to plain-text offsets within
 *  `containerEl`, and reports [start, end] via `onRange` — matching the
 *  reference implementation's `surroundContents` trigger, but offset-based
 *  so it survives React re-renders instead of mutating the DOM directly. */
function captureSelectionRange(containerEl: HTMLElement, onRange: (start: number, end: number) => void) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
  const range = sel.getRangeAt(0)
  if (!containerEl.contains(range.commonAncestorContainer)) return
  const start = textOffset(containerEl, range.startContainer, range.startOffset)
  const end = textOffset(containerEl, range.endContainer, range.endOffset)
  sel.removeAllRanges()
  if (start == null || end == null || start === end) return
  onRange(Math.min(start, end), Math.max(start, end))
}

/** Splits `text` into segments honoring an optional underline range and any
 *  number of highlight ranges, rendering highlighted segments in a clickable
 *  <mark> (click removes that highlight). */
function renderMarkedText(
  text: string,
  underline: { start: number; end: number } | null,
  highlights: HlRange[],
  onRemoveHighlight: (id: string) => void,
) {
  const len = text.length
  const points = new Set<number>([0, len])
  if (underline) {
    points.add(Math.max(0, underline.start))
    points.add(Math.min(len, underline.end))
  }
  for (const h of highlights) {
    points.add(Math.max(0, h.start))
    points.add(Math.min(len, h.end))
  }
  const sorted = Array.from(points)
    .filter((p) => p >= 0 && p <= len)
    .sort((a, b) => a - b)

  const nodes: React.ReactNode[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (a === b) continue
    const seg = text.slice(a, b)
    const isUnderline = !!underline && a >= underline.start && b <= underline.end
    const hit = highlights.find((h) => a >= h.start && b <= h.end)

    let node: React.ReactNode = seg
    if (isUnderline) {
      node = <span className="underline decoration-[#111] decoration-1 underline-offset-2">{node}</span>
    }
    if (hit) {
      node = (
        <mark
          onClick={() => onRemoveHighlight(hit.id)}
          title="Olib tashlash uchun bosing"
          className="cursor-pointer rounded-[1px] bg-[#ffe97a]"
        >
          {node}
        </mark>
      )
    }
    nodes.push(<span key={a}>{node}</span>)
  }
  return nodes
}

/**
 * Enforces the real Digital SAT student-produced response input rules:
 * only digits, one decimal point OR one fraction slash, and an optional
 * leading minus sign are allowed. Up to 5 characters are accepted, not
 * counting the minus sign.
 */
function sanitizeGridInput(raw: string): string {
  let cleaned = raw.replace(/[^0-9./-]/g, '')

  const negative = cleaned.trim().startsWith('-')
  cleaned = cleaned.replace(/-/g, '')

  // Only one of '.' or '/' may appear, whichever comes first.
  const dotIdx = cleaned.indexOf('.')
  const slashIdx = cleaned.indexOf('/')
  if (dotIdx !== -1 && slashIdx !== -1) {
    cleaned = dotIdx < slashIdx ? cleaned.replace(/\//g, '') : cleaned.replace(/\./g, '')
  }
  // Collapse any repeats of whichever separator remains.
  const sepIdx = cleaned.search(/[./]/)
  if (sepIdx !== -1) {
    const sep = cleaned[sepIdx]
    cleaned = cleaned.slice(0, sepIdx + 1) + cleaned.slice(sepIdx + 1).split(sep).join('')
  }

  if (cleaned.length > 5) cleaned = cleaned.slice(0, 5)

  return (negative ? '-' : '') + cleaned
}

function gridPreview(v: string) {
  const m = v.match(/^(-?)(\d+)\/(\d+)$/)
  if (m) return `${m[1]}\\dfrac{${m[2]}}{${m[3]}}`
  return v.replace(/%/g, '\\%')
}

/** Phones / tablets (touch) get the on-screen keypad below; their own number pad has no "−" or "/" key. */
function useTouchKeypad() {
  const [touch, setTouch] = useState(false)
  useEffect(() => {
    const mqs = [window.matchMedia('(pointer: coarse)'), window.matchMedia('(max-width: 767px)')]
    const update = () => setTouch(mqs.some((m) => m.matches))
    update()
    mqs.forEach((m) => m.addEventListener('change', update))
    return () => mqs.forEach((m) => m.removeEventListener('change', update))
  }, [])
  return touch
}

/**
 * Number pad for the student-produced response on touch screens: digits, a real minus key (sign toggle),
 * decimal point, fraction slash, backspace and clear — everything the SAT answer box accepts, which the
 * phone's own "decimal" keyboard cannot type (no "−", no "/"). Every key goes through sanitizeGridInput,
 * so the same rules apply as on a computer keyboard.
 */
function GridKeypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const press = (ch: string) => onChange(sanitizeGridInput(value + ch))
  const toggleMinus = () => onChange(sanitizeGridInput(value.startsWith('-') ? value.slice(1) : '-' + value))
  const base =
    'flex h-[50px] select-none items-center justify-center rounded-xl border border-[#cfd8d6] text-[22px] font-semibold shadow-[0_1px_0_rgba(0,0,0,.08)] active:translate-y-px active:bg-[#e3f4f1] touch-manipulation'
  const key = `${base} bg-white text-[#111]`
  const fn = `${base} bg-[#f3f6f6] text-[#0b4f4a]`
  const noFocus = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault() // keep the answer box focused
  const k = (id: string, label: React.ReactNode, onClick: () => void, cls = key, aria?: string, extra = '') => (
    <button key={id} type="button" onPointerDown={noFocus} onClick={onClick} aria-label={aria} className={`${cls} ${extra}`}>
      {label}
    </button>
  )
  return (
    <div role="group" aria-label="Raqamli klaviatura" className="mt-4 grid w-full max-w-[320px] grid-cols-4 gap-2">
      {['7', '8', '9'].map((d) => k(d, d, () => press(d)))}
      {k('bs', <Delete className="size-6" />, () => onChange(value.slice(0, -1)), fn, 'O‘chirish (backspace)')}
      {['4', '5', '6'].map((d) => k(d, d, () => press(d)))}
      {k('minus', '−', toggleMinus, fn, 'Minus belgisi')}
      {['1', '2', '3'].map((d) => k(d, d, () => press(d)))}
      {k('slash', '/', () => press('/'), fn, 'Kasr chizig‘i')}
      {k('0', '0', () => press('0'))}
      {k('dot', '.', () => press('.'), fn, 'Kasr nuqta')}
      {k('clear', 'Tozalash', () => onChange(''), `${fn} !text-[15px]`, 'Hammasini tozalash', 'col-span-2')}
    </div>
  )
}

/** Bluebook-style student-produced response box: a small rounded box with a
 *  writing line inside, and an always-visible "Answer Preview:" underneath.
 *  On touch screens an on-screen number pad (with −, / and .) replaces the phone keyboard. */
export function GridInInput({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const v = value ?? ''
  const touch = useTouchKeypad()
  const [system, setSystem] = useState(false) // the student prefers the phone's own keyboard
  const keypad = touch && !system
  return (
    <div className="flex flex-col">
      <label
        htmlFor="gridin-answer"
        className="relative block h-[62px] w-[112px] cursor-text rounded-[8px] border border-[#3a3a3a] bg-white transition-shadow focus-within:border-[#111] focus-within:shadow-[0_0_0_2px_rgba(14,124,117,0.25)]"
      >
        <input
          id="gridin-answer"
          type="text"
          // keypad: no phone keyboard pops up; otherwise a full keyboard on touch (it has − and /), numeric on desktop
          inputMode={keypad ? 'none' : touch ? 'text' : 'decimal'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Answer"
          value={v}
          onChange={(e) => onChange(sanitizeGridInput(e.target.value))}
          className="absolute inset-x-0 top-0 h-[44px] w-full bg-transparent px-3 pt-2 text-[22px] tracking-[0.02em] text-[#111] outline-none"
          // Same face as the Answer Preview (KaTeX's serif), so typed digits match it.
          style={{ fontFamily: "KaTeX_Main, 'Times New Roman', serif" }}
        />
        <span aria-hidden className="pointer-events-none absolute bottom-[13px] left-3 right-3 h-px bg-[#3a3a3a]" />
      </label>

      <div className="mt-9 flex items-baseline gap-1.5 font-[Georgia,'Times_New_Roman',serif] text-[19px] text-[#1a1a1a]">
        <span className="font-bold">Answer Preview:</span>
        {v && (
          <span className="text-[20px]">
            <MathTex tex={gridPreview(v)} />
          </span>
        )}
      </div>

      {keypad && <GridKeypad value={v} onChange={onChange} />}
      {touch && (
        <button
          type="button"
          onClick={() => setSystem((x) => !x)}
          className="mt-3 flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-[#0b4f4a] underline underline-offset-2"
        >
          <Keyboard className="size-4" />
          {keypad ? 'Telefon klaviaturasidan foydalanish' : 'Raqamli klaviaturaga qaytish'}
        </button>
      )}
    </div>
  )
}

const MIN_PCT = 25
const MAX_PCT = 75

function QuestionViewImpl({
  module,
  index,
  question,
  selected,
  eliminated,
  flagged,
  onSelect,
  onToggleEliminate,
  onToggleFlag,
  registerHighlightTrigger,
  compact,
  editLayout,
  onLayoutEdit,
}: QuestionViewProps) {
  // A saved layout (or the admin editing one) draws the stimulus as blocks;
  // otherwise the classic order below is used, unchanged.
  const useStimulus = !!editLayout || !!question.layout?.rows?.length
  const [crossOutMode, setCrossOutMode] = useState(false)
  const isMobile = useIsMobile(1024) // matches the lg: breakpoint used for the divider
  const isGridIn = question.type === 'gridin'
  const qKey = `${module.id}:${index}`

  /* ----------------------------- divider drag ----------------------------- */
  const [leftPct, setLeftPct] = useState(50)
  const mainRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  useEffect(() => {
    function move(e: MouseEvent) {
      if (!dragging.current || !mainRef.current) return
      const r = mainRef.current.getBoundingClientRect()
      let pct = ((e.clientX - r.left) / r.width) * 100
      pct = Math.min(MAX_PCT, Math.max(MIN_PCT, pct))
      setLeftPct(pct)
    }
    function up() {
      dragging.current = false
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [])

  /* ------------------------------ highlights ------------------------------ */
  const passageRef = useRef<HTMLDivElement>(null)
  const [highlightsByQ, setHighlightsByQ] = useState<Record<string, HlRange[]>>({})
  const highlights = highlightsByQ[qKey] ?? []

  useEffect(() => {
    if (!registerHighlightTrigger) return
    if (module.kind !== 'reading') {
      registerHighlightTrigger(null)
      return
    }
    registerHighlightTrigger(() => {
      if (!passageRef.current) return
      captureSelectionRange(passageRef.current, (start, end) => {
        setHighlightsByQ((m) => ({
          ...m,
          [qKey]: [...(m[qKey] ?? []), { id: `${Date.now()}-${Math.random()}`, start, end }],
        }))
      })
    })
    return () => registerHighlightTrigger(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.kind, qKey])

  function removeHighlight(id: string) {
    setHighlightsByQ((m) => ({ ...m, [qKey]: (m[qKey] ?? []).filter((h) => h.id !== id) }))
  }

  const passageText = question.passage ?? ''
  const underlineRange = useMemo(() => {
    if (!question.underline) return null
    const start = passageText.indexOf(question.underline)
    if (start === -1) return null
    return { start, end: start + question.underline.length }
  }, [passageText, question.underline])

  const markedPassage = useMemo(
    () => renderMarkedText(passageText, underlineRange, highlights, removeHighlight),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [passageText, underlineRange, highlights],
  )

  /* -------------------------------- q-head -------------------------------- */
  const header = (
    <div className="mb-4 flex flex-wrap items-center gap-3 border-b-2 border-dashed border-[#111] bg-[#ececec] px-3 py-1.5">
      <span className="flex h-[30px] w-[27px] shrink-0 items-center justify-center bg-[#111] text-sm font-bold text-white">
        {index + 1}
      </span>
      <button
        type="button"
        onClick={onToggleFlag}
        aria-pressed={flagged}
        className={`flex items-center gap-1.5 rounded-sm px-2 py-1 text-[13.5px] transition-colors ${
          flagged ? 'font-bold text-[#c8102e]' : 'font-semibold text-[#333] hover:text-[#111]'
        }`}
      >
        <Bookmark
          className="size-4"
          style={flagged ? { fill: '#c8102e', stroke: '#c8102e' } : { fill: 'none', stroke: 'currentColor' }}
        />
        {flagged ? 'Marked for Review' : 'Mark for Review'}
      </button>
      {!isGridIn && (
        <button
          type="button"
          onClick={() => setCrossOutMode((v) => !v)}
          aria-pressed={crossOutMode}
          aria-label="Toggle answer eliminator"
          className={`ml-auto flex h-6 w-7 items-center justify-center rounded border text-[11px] font-bold transition-colors ${
            crossOutMode
              ? 'border-[#0e7c75] bg-[#0e7c75] text-white'
              : 'border-[#0e7c75] bg-white text-[#0e7c75] hover:bg-[#d2ebe7]'
          }`}
        >
          <span className="relative">
            ABC
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 -rotate-[8deg] bg-current" />
          </span>
        </button>
      )}
    </div>
  )

  const options = isGridIn ? (
    <GridInInput value={selected} onChange={onSelect} />
  ) : (
    <div role="radiogroup" aria-label={`Answer choices for question ${index + 1}`} className="flex flex-col gap-2.5">
      {(question.choices ?? []).map((opt) => (
        <OptionCard
          key={opt.id}
          option={opt}
          selected={selected === opt.id}
          eliminated={eliminated.includes(opt.id)}
          crossOutMode={crossOutMode}
          serif={module.kind === 'reading'}
          onSelect={() => onSelect(opt.id)}
          onToggleEliminate={() => onToggleEliminate(opt.id)}
          imageScale={question.layout?.choiceImg?.[opt.id]?.scale}
          editImage={editLayout}
          onImageScaleChange={(s) => setChoiceImageScale(opt.id, s)}
        />
      ))}
    </div>
  )

  const equations = question.equations && question.equations.length > 0 && (
    <div className="my-2.5 flex flex-col items-center gap-1 py-0 [&_.katex-display]:!my-0.5">
      {question.equations.map((eq) => (
        <MathTex key={eq} tex={eq} display className="text-[#111]" />
      ))}
    </div>
  )

  // Reading keeps its figure in the passage pane, outside the block editor —
  // its default size is still settable there in the admin preview.
  function setImageScale(scale: number) {
    if (!onLayoutEdit) return
    const { blocks, rows } = resolveRows(question, module.kind === 'math')
    onLayoutEdit(serializeLayout(blocks, rows, { scale }, question.layout?.styles, question.layout?.choiceImg))
  }
  function setChoiceImageScale(id: string, scale: number) {
    if (!onLayoutEdit) return
    const { blocks, rows } = resolveRows(question, module.kind === 'math')
    const next = { ...(question.layout?.choiceImg ?? {}), [id]: { scale } }
    onLayoutEdit(serializeLayout(blocks, rows, question.layout?.img, question.layout?.styles, next))
  }
  const image = question.image ? (
    <QuestionImage
      key={question.image}
      src={question.image}
      scale={question.layout?.img?.scale}
      editable={editLayout}
      onScaleChange={setImageScale}
    />
  ) : null

  /* ------------------------------ Reading ------------------------------ */
  if (module.kind === 'reading') {
    // On mobile the passage/question split stacks into one scrolling column
    // (no draggable divider, no percentage widths) — side-by-side panes don't
    // fit a phone screen, and the lg:-only divider has nothing to control there.
    return (
      <div
        ref={mainRef}
        className="flex h-full w-full flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
      >
        <section
          className="flex flex-col px-4 py-5 sm:px-5 sm:py-6 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-10 lg:py-8"
          style={isMobile ? undefined : { width: `${leftPct}%` }}
        >
          <div ref={passageRef} className="whitespace-pre-line select-text font-serif text-[14px] leading-[1.4] text-[#111] sm:text-[16.2px] sm:leading-[1.43]">
            {markedPassage}
          </div>
          {image}
        </section>

        {/* Divider — drag to resize, 25%-75% clamp (desktop/tablet only) */}
        <div
          onMouseDown={(e) => {
            dragging.current = true
            document.body.style.cursor = 'col-resize'
            e.preventDefault()
          }}
          className="relative hidden w-1 shrink-0 cursor-col-resize bg-[#8b8b8b] lg:block"
        >
          <span className="absolute left-1/2 top-1/2 flex h-[26px] w-[13px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm bg-[#2b2b2b]">
            <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
              <path d="M5 1L1.5 6L5 11" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 1L4.5 6L8 11" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        <section
          className="flex flex-col border-t border-[#e2e8f0] px-4 py-5 sm:px-5 sm:py-6 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:border-t-0 lg:px-10 lg:py-8"
          style={isMobile ? undefined : { width: `${100 - leftPct}%` }}
        >
          {header}
          {useStimulus ? (
            <div className="mb-4">
              <QuestionStimulus
                question={question}
                withFigure={false}
                textClassName="text-[14.5px] font-semibold leading-[1.5] text-[#111] text-pretty sm:text-[16px] sm:leading-relaxed"
                editable={editLayout}
                onEdit={onLayoutEdit}
              />
            </div>
          ) : (
            <div className="mb-4 text-[14.5px] font-semibold leading-[1.5] text-[#111] text-pretty sm:text-[16px] sm:leading-relaxed">
              <RichText text={question.prompt} />
            </div>
          )}
          {options}
        </section>
      </div>
    )
  }

  /* -------------------------------- Math (background: white / #f8fafc) ------------------------------- */
  return (
    <div className="h-full w-full overflow-y-auto bg-[#f8fafc]">
      <div
        className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-5 sm:py-6 lg:py-10"
        style={compact ? { zoom: 0.88 } : undefined}
      >
        {header}
        {useStimulus ? (
          <div className="mb-2">
            <QuestionStimulus
              question={question}
              withFigure
              textClassName="text-[15px] leading-[1.6] text-[#111] text-pretty sm:text-[16px] sm:leading-[1.7]"
              editable={editLayout}
              onEdit={onLayoutEdit}
            />
          </div>
        ) : (
          <>
            {/* Bluebook order: the given figure/equation comes first, then the
                question sentence asking about it — not the other way round. */}
            {image}
            {equations}
            <div className="mb-2 text-[15px] leading-[1.6] text-[#111] text-pretty sm:text-[16px] sm:leading-[1.7]">
              <RichText text={question.prompt} />
            </div>
          </>
        )}
        <div className="mt-5">{options}</div>
      </div>
    </div>
  )
}

/** Memoised: the exam timer re-renders the page every second — the question (and its KaTeX) must not. */
export const QuestionView = memo(QuestionViewImpl)
