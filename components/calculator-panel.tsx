'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useIsMobile } from '@/lib/use-is-mobile'

const DESMOS_SRC =
  'https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Desmos?: any
  }
}

const MIN_WIDTH = 340
const MIN_HEIGHT = 380
export const DEFAULT_WIDTH = 630
/** Default panel height on a tall screen (it shrinks to fit shorter ones). */
export const DEFAULT_HEIGHT = 980
/** Gap kept between the panel's right edge and the shifted question text. */
export const PANEL_LEFT_GAP = 16
/** Fallback shift (px) when the panel hasn't reported its size yet. */
export const CONTENT_SHIFT = DEFAULT_WIDTH + PANEL_LEFT_GAP

/** Mobile bottom-sheet height. The exam page pads the question area by the
 *  same amount so every line (and every answer choice) can be scrolled into
 *  view above the open calculator. */
export const MOBILE_SHEET_HEIGHT = '46dvh'
const MOBILE_MIN_SHEET = 220

type Mode = 'graphing' | 'scientific'

/**
 * Bluebook-style Desmos panel.
 *
 * Desktop: opens docked on the LEFT, full height (from the top of the page
 * down to the footer), with Bluebook's dark title bar — Graphing / Scientific
 * switch, a ⠿ grip to drag it anywhere, × to close — and a round ⤡ handle at
 * the bottom-right corner to resize it. Desmos' own zoom +/− and the "home"
 * (default view) buttons are on the graph.
 *
 * Both calculators are created once and stay mounted (hidden with CSS), so
 * reopening or switching is instant and nothing typed is lost.
 */
export function CalculatorPanel({
  open,
  onClose,
  bottomOffset = 0,
  onRectChange,
  onSheetHeightChange,
}: {
  open: boolean
  onClose: () => void
  /** Px kept clear at the bottom (the exam footer). */
  bottomOffset?: number
  /** Reports where the panel is, so the page can shift the question text right of it. */
  onRectChange?: (rect: { x: number; width: number }) => void
  /** Mobile: reports the sheet's height in px after the student drags its top edge. */
  onSheetHeightChange?: (px: number | null) => void
}) {
  const graphRef = useRef<HTMLDivElement>(null)
  const sciRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphCalc = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sciCalc = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<Mode>('graphing')
  const isMobile = useIsMobile()

  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const drag = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resize = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null)
  const [interacting, setInteracting] = useState(false)
  // Mobile sheet: the bottom stays pinned; dragging the title bar up/down moves only the top edge.
  const [sheetH, setSheetH] = useState<number | null>(null)
  const sheetDrag = useRef<{ startY: number; origH: number } | null>(null)

  /* ------------------------- default: docked, full height ------------------------- */
  const fullHeight = useCallback(
    () => Math.max(MIN_HEIGHT, Math.min(DEFAULT_HEIGHT, window.innerHeight - bottomOffset)),
    [bottomOffset],
  )

  useEffect(() => {
    if (size) return
    const width = Math.min(DEFAULT_WIDTH, Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.5)))
    setSize({ width, height: fullHeight() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the default full-height panel matched to the footer once it's measured.
  const userResized = useRef(false)
  useEffect(() => {
    if (!size || userResized.current) return
    setSize((s) => (s ? { ...s, height: fullHeight() } : s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomOffset])

  // Stay inside the window when it is resized.
  useEffect(() => {
    function onWin() {
      setSize((s) => {
        if (!s) return s
        const width = Math.min(s.width, window.innerWidth - 16)
        const height = userResized.current ? Math.min(s.height, window.innerHeight - 8) : fullHeight()
        return { width: Math.max(MIN_WIDTH, width), height: Math.max(MIN_HEIGHT, height) }
      })
      setPos((p) => ({
        x: Math.min(p.x, Math.max(0, window.innerWidth - 120)),
        y: Math.min(p.y, Math.max(0, window.innerHeight - 80)),
      }))
    }
    window.addEventListener('resize', onWin)
    return () => window.removeEventListener('resize', onWin)
  }, [fullHeight])

  // Tell the page where we are (after a drag / resize ends, not on every pixel).
  useEffect(() => {
    if (size && !interacting) onRectChange?.({ x: pos.x, width: size.width })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.x, size?.width, interacting])

  /* --------------------------------- Desmos --------------------------------- */
  useEffect(() => {
    let cancelled = false
    function mount() {
      if (cancelled || !window.Desmos || !graphRef.current || graphCalc.current) return
      graphCalc.current = window.Desmos.GraphingCalculator(graphRef.current, {
        expressionsCollapsed: false,
        settingsMenu: true,
        zoomButtons: true,
        border: false,
        lockViewport: false,
        keypad: true,
      })
      setReady(true)
    }
    if (window.Desmos) {
      mount()
    } else {
      let script = document.querySelector<HTMLScriptElement>('script[data-desmos]')
      if (!script) {
        script = document.createElement('script')
        script.src = DESMOS_SRC
        script.async = true
        script.dataset.desmos = 'true'
        document.head.appendChild(script)
      }
      script.addEventListener('load', mount)
    }
    return () => {
      cancelled = true
    }
  }, [])

  // The scientific calculator is created the first time it's chosen.
  useEffect(() => {
    if (mode !== 'scientific' || sciCalc.current || !window.Desmos || !sciRef.current) return
    sciCalc.current = window.Desmos.ScientificCalculator(sciRef.current, { border: false })
  }, [mode, ready])

  useEffect(() => {
    return () => {
      graphCalc.current?.destroy?.()
      sciCalc.current?.destroy?.()
      graphCalc.current = null
      sciCalc.current = null
    }
  }, [])

  // Desmos needs a resize nudge whenever its box changes or becomes visible.
  useEffect(() => {
    graphCalc.current?.resize?.()
    sciCalc.current?.resize?.()
  }, [size, open, mode, isMobile, sheetH])

  /* ------------------------------- drag / resize ------------------------------ */
  function clampPos(x: number, y: number) {
    const w = size?.width ?? DEFAULT_WIDTH
    return {
      x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - Math.min(w, 160))),
      y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - 60)),
    }
  }

  function onDragStart(e: React.PointerEvent) {
    drag.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setInteracting(true)
  }
  function onDragMove(e: React.PointerEvent) {
    if (!drag.current) return
    setPos(clampPos(drag.current.origX + e.clientX - drag.current.startX, drag.current.origY + e.clientY - drag.current.startY))
  }
  function onDragEnd() {
    drag.current = null
    setInteracting(false)
  }

  function onResizeStart(e: React.PointerEvent) {
    if (!size) return
    e.stopPropagation()
    resize.current = { startX: e.clientX, startY: e.clientY, origW: size.width, origH: size.height }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    userResized.current = true
    setInteracting(true)
  }
  function onResizeMove(e: React.PointerEvent) {
    if (!resize.current) return
    const maxW = window.innerWidth - pos.x - 8
    const maxH = window.innerHeight - pos.y - 4
    setSize({
      width: Math.min(maxW, Math.max(MIN_WIDTH, resize.current.origW + e.clientX - resize.current.startX)),
      height: Math.min(maxH, Math.max(MIN_HEIGHT, resize.current.origH + e.clientY - resize.current.startY)),
    })
  }
  function onResizeEnd() {
    resize.current = null
    setInteracting(false)
  }

  const maxSheet = () => Math.max(MOBILE_MIN_SHEET, window.innerHeight - bottomOffset - 70)
  function onSheetStart(e: React.PointerEvent) {
    const el = (e.currentTarget as HTMLElement).parentElement as HTMLElement
    sheetDrag.current = { startY: e.clientY, origH: el.getBoundingClientRect().height }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setInteracting(true)
  }
  function onSheetMove(e: React.PointerEvent) {
    const d = sheetDrag.current
    if (!d) return
    // Finger up = taller (the top edge follows the finger); the bottom never moves.
    const h = Math.min(maxSheet(), Math.max(MOBILE_MIN_SHEET, d.origH + (d.startY - e.clientY)))
    setSheetH(h)
  }
  function onSheetEnd() {
    if (!sheetDrag.current) return
    sheetDrag.current = null
    setInteracting(false)
    graphCalc.current?.resize?.()
    sciCalc.current?.resize?.()
    onSheetHeightChange?.(sheetH)
  }

  /* ---------------------------------- pieces ---------------------------------- */
  const header = (draggable: boolean, sheet = false) => (
    <div
      onPointerDown={draggable ? onDragStart : sheet ? onSheetStart : undefined}
      onPointerMove={draggable ? onDragMove : sheet ? onSheetMove : undefined}
      onPointerUp={draggable ? onDragEnd : sheet ? onSheetEnd : undefined}
      onPointerCancel={draggable ? onDragEnd : sheet ? onSheetEnd : undefined}
      className={`flex h-[50px] shrink-0 touch-none select-none items-center gap-3 bg-[#1e1e1e] px-3 ${
        draggable ? 'cursor-move' : ''
      } ${sheet ? 'relative' : ''}`}
    >
      {/* Graphing / Scientific */}
      <div
        className="flex shrink-0 overflow-hidden rounded-md border border-white/80"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {(
          [
            ['graphing', 'Graphing', <GraphIcon key="g" />],
            ['scientific', 'Scientific', <SciIcon key="s" />],
          ] as [Mode, string, React.ReactNode][]
        ).map(([m, label, icon]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[13px] font-bold transition-colors ${
              mode === m ? 'bg-white text-[#111] underline underline-offset-2' : 'bg-transparent text-white hover:bg-white/10'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* ⠿ grip — has its own slot between the switch and ×, so it never overlaps them */}
      <span aria-hidden className="pointer-events-none flex min-w-0 flex-1 justify-center">
        {sheet && (
          <span className="h-1 w-10 rounded-full bg-white/70" />
        )}
        {draggable && (
          <svg width="22" height="14" viewBox="0 0 22 14" fill="#fff" className="shrink-0">
            {[3, 11, 19].flatMap((cx) => [3, 11].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" />))}
          </svg>
        )}
      </span>

      <button
        type="button"
        // Keep the title-bar drag from swallowing this click.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
        aria-label="Close calculator"
        className="shrink-0 rounded p-1 text-white/90 transition-colors hover:bg-white/15 hover:text-white"
      >
        <X className="size-6" strokeWidth={1.8} />
      </button>
    </div>
  )

  const body = (
    <div className="relative min-h-0 flex-1 bg-white">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[#64748b]">Yuklanmoqda…</div>
      )}
      <div ref={graphRef} className="absolute inset-0" style={{ visibility: mode === 'graphing' ? 'visible' : 'hidden' }} />
      <div ref={sciRef} className="absolute inset-0" style={{ visibility: mode === 'scientific' ? 'visible' : 'hidden' }} />
    </div>
  )

  /* ---------------------------------- mobile ---------------------------------- */
  if (isMobile) {
    return (
      <div
        className={`fixed inset-x-0 z-40 flex flex-col overflow-hidden rounded-t-xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.3)] ease-in-out ${interacting ? '' : 'transition-transform duration-[600ms]'}`}
        style={{
          height: sheetH ?? MOBILE_SHEET_HEIGHT,
          bottom: bottomOffset,
          transform: open ? 'translateY(0)' : `translateY(calc(100% + ${bottomOffset}px))`,
          pointerEvents: open ? 'auto' : 'none',
        }}
        role="dialog"
        aria-label="Calculator"
        aria-hidden={!open}
      >
        {header(false, true)}
        {body}
      </div>
    )
  }

  /* --------------------------------- desktop --------------------------------- */
  return (
    <div
      className="fixed z-40"
      style={{
        left: pos.x,
        top: pos.y,
        width: size?.width ?? DEFAULT_WIDTH,
        height: size?.height ?? 600,
        opacity: open ? 1 : 0,
        transform: open ? 'translateX(0)' : 'translateX(-56px)',
        transition: interacting ? 'none' : 'opacity 700ms cubic-bezier(.4,0,.2,1), transform 700ms cubic-bezier(.4,0,.2,1), visibility 0s linear ' + (open ? '0s' : '700ms'),
        pointerEvents: open ? 'auto' : 'none',
        visibility: open ? 'visible' : 'hidden',
      }}
      role="dialog"
      aria-label="Calculator"
      aria-hidden={!open}
    >
      <div className="flex h-full w-full flex-col overflow-hidden border border-[#b9b9b9] bg-white shadow-[4px_0_24px_rgba(0,0,0,0.18)]">
        {header(true)}
        {body}
      </div>

      {/* ⤡ resize handle — round, just outside the bottom-right corner */}
      <button
        type="button"
        aria-label="Resize calculator"
        title="Kattalashtirish / kichraytirish"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        className="absolute -bottom-3 -right-3 flex size-7 cursor-nwse-resize touch-none items-center justify-center rounded-full border border-[#9a9a9a] bg-white text-[#111] shadow-md hover:bg-[#f2f2f2]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 2l10 10" />
          <path d="M2 6.5V2h4.5" />
          <path d="M12 7.5V12H7.5" />
        </svg>
      </button>
    </div>
  )
}

function GraphIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M1 12c2.5 0 3-9 6-9s3 8 6 8 2.5-4 4-4" />
      <path d="M1 1v12h16" strokeWidth="1.1" opacity="0.7" />
    </svg>
  )
}

function SciIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="1" width="11" height="14" rx="1.5" />
      <path d="M4 4h6" />
      <path d="M4 8h1M7 8h1M10 8h0.01M4 11h1M7 11h1M10 11h0.01" strokeLinecap="round" />
    </svg>
  )
}
