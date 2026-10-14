'use client'

import { useEffect, useRef, useState } from 'react'
import { Bookmark, ChevronDown } from 'lucide-react'
import { Math as MathTex } from '@/components/math'
import { useT } from '@/components/i18n-provider'

/**
 * Silent, looping product demo drawn with the real exam colours:
 * a cursor glides over the answers (hover tint) → picks B (green badge) → opens Desmos, which slides
 * in from the LEFT while the question glides to the right (same as the real /exam) → presses Next.
 */

const CHOICES = [
  { id: 'A', tex: '3' },
  { id: 'B', tex: '5' },
  { id: 'C', tex: '15' },
  { id: 'D', tex: '25' },
] as const
type ChoiceId = (typeof CHOICES)[number]['id']

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function HeroDemo() {
  const t = useT()
  const boxRef = useRef<HTMLDivElement>(null)
  const optRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const calcRef = useRef<HTMLSpanElement>(null)
  const nextRef = useRef<HTMLSpanElement>(null)

  const [cursor, setCursor] = useState({ x: 260, y: 250, down: false, show: false })
  const [hover, setHover] = useState<ChoiceId | null>(null)
  const [selected, setSelected] = useState<ChoiceId | null>(null)
  const [calc, setCalc] = useState(false)
  const [nextPress, setNextPress] = useState(false)
  const [fade, setFade] = useState(false)
  const [secs, setSecs] = useState(32 * 60 + 8)
  const [inView, setInView] = useState(true)

  // Only animate while on screen.
  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const t = setInterval(() => setSecs((s) => (s <= 0 ? 32 * 60 : s - 1)), 1000)
    return () => clearInterval(t)
  }, [inView])

  useEffect(() => {
    if (!inView) return
    let dead = false
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setSelected('B')
      setCalc(true)
      return
    }

    function center(el: HTMLElement | null) {
      const box = boxRef.current
      if (!el || !box) return null
      const b = box.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return { x: r.left - b.left + r.width * 0.55, y: r.top - b.top + r.height * 0.55 }
    }
    async function glide(el: HTMLElement | null, ms = 760) {
      const c = center(el)
      if (!c || dead) return
      setCursor((p) => ({ ...p, x: c.x, y: c.y, show: true }))
      await wait(ms)
    }
    async function click() {
      setCursor((p) => ({ ...p, down: true }))
      await wait(170)
      setCursor((p) => ({ ...p, down: false }))
    }

    async function loop() {
      while (!dead) {
        setFade(false)
        setHover(null)
        setSelected(null)
        setCalc(false)
        setNextPress(false)
        const box = boxRef.current
        if (box) setCursor({ x: box.clientWidth * 0.82, y: box.clientHeight * 0.9, down: false, show: false })
        await wait(650)
        if (dead) return
        await glide(optRefs.current.C, 900)
        setHover('C')
        await wait(520)
        if (dead) return
        await glide(optRefs.current.B)
        setHover('B')
        await wait(520)
        if (dead) return
        await click()
        setSelected('B')
        await wait(900)
        if (dead) return
        setHover(null)
        await glide(calcRef.current)
        await wait(200)
        await click()
        setCalc(true)
        await wait(1900)
        if (dead) return
        await glide(nextRef.current, 820)
        await click()
        setNextPress(true)
        await wait(900)
        if (dead) return
        setFade(true)
        await wait(650)
      }
    }
    loop()
    return () => {
      dead = true
    }
  }, [inView])

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return (
    <div className="relative rounded-2xl overflow-hidden sp-glass shadow-[0_32px_64px_-28px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-sp-border">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E7A2A2]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#EFCB8B]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#9AD1AE]" />
        </div>
        <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-sp-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          DEMO
        </div>
      </div>

      {/* ---------------- the "exam window" ---------------- */}
      <div ref={boxRef} aria-hidden className="relative flex h-[272px] sm:h-[296px] flex-col overflow-hidden bg-[#f8fafc] text-[#111] select-none">
        {/* header */}
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#d7e7e4] bg-[#e7f3f1] px-3">
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[11px] font-bold text-[#0b4f4a]">Section 2, Module 1: Math</div>
            <div className="flex items-center gap-0.5 text-[9.5px] font-semibold text-[#0e7c75]">
              Directions <ChevronDown size={10} />
            </div>
          </div>
          <div className="text-[14px] font-bold tabular-nums">{mm}:{ss}</div>
          <span
            ref={calcRef}
            className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold transition-colors duration-300 ${
              calc ? 'bg-[#0e7c75] text-white' : 'text-[#375957]'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M8 6h8M7 11h2M11 11h2M15 11h2M7 15h2M11 15h2M15 15h2" strokeLinecap="round" />
            </svg>
            Desmos
          </span>
        </div>

        {/* body */}
        <div className="relative flex min-h-0 flex-1">
          {/* Desmos — opens on the LEFT */}
          <div
            className="absolute inset-y-0 left-0 z-10 w-[46%] overflow-hidden border-r border-[#c7d6d4] bg-white shadow-[6px_0_22px_-10px_rgba(0,0,0,0.35)] transition-transform duration-[900ms] ease-in-out"
            style={{ transform: calc ? 'translateX(0)' : 'translateX(-102%)' }}
          >
            <div className="flex h-5 items-center justify-between bg-[#2b3340] px-2 text-[9px] font-bold text-white">
              <span>Graphing</span>
              <span className="opacity-60">⠿ ×</span>
            </div>
            <div className="relative h-[calc(100%-20px)]">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}
              />
              <div className="absolute left-0 top-0 z-[1] w-[58%] border-b border-r border-[#e5e7eb] bg-white/95 px-1.5 py-1 font-mono text-[9.5px] font-semibold text-[#1f2937]">
                <span className="mr-1 inline-block size-2 rounded-full bg-[#c74440] align-middle" />
                y = 3x + 5
                <div className="mt-0.5 text-[9px] text-[#0e7c75]">(5, 20) ✓</div>
              </div>
              <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="0" y1="62" x2="100" y2="62" stroke="#9ca3af" strokeWidth="0.6" />
                <line x1="30" y1="0" x2="30" y2="100" stroke="#9ca3af" strokeWidth="0.6" />
                <path
                  d="M2 92 L98 14"
                  fill="none"
                  stroke="#c74440"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  pathLength={100}
                  style={{
                    strokeDasharray: 100,
                    strokeDashoffset: calc ? 0 : 100,
                    transition: calc ? 'stroke-dashoffset 1s ease-out 0.9s' : 'none',
                  }}
                />
                <circle cx="62" cy="38" r="2.4" fill="#2d70b3" style={{ opacity: calc ? 1 : 0, transition: 'opacity .4s 1.7s' }} />
              </svg>
            </div>
          </div>

          {/* question — glides to the right when Desmos opens */}
          <div
            className="min-w-0 flex-1 px-3 pt-2 transition-[margin-left] duration-[900ms] ease-in-out"
            style={{ marginLeft: calc ? '46%' : 0 }}
          >
            <div className="mb-1.5 flex items-center gap-2 overflow-hidden border-b-2 border-dashed border-[#111] bg-[#ececec] px-2 py-0.5 transition-all duration-[900ms]" style={{ maxHeight: calc ? 0 : 28, opacity: calc ? 0 : 1, marginBottom: calc ? 0 : 6, paddingTop: calc ? 0 : undefined, paddingBottom: calc ? 0 : undefined, borderBottomWidth: calc ? 0 : undefined }}>
              <span className="flex h-[19px] w-[18px] items-center justify-center bg-[#111] text-[11px] font-bold text-white">7</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-[#333]">
                <Bookmark size={11} /> Mark for Review
              </span>
              <span className="ml-auto rounded-full bg-[#fef3c7] px-1.5 text-[8.5px] font-bold tracking-wide text-[#92400e]">MEDIUM</span>
            </div>
            <p className="mb-1.5 text-[12.5px] leading-[1.45] text-[#111]">
              If <MathTex tex="3x + 5 = 20" />, what is the value of <MathTex tex="x" />?
            </p>
            <div className="flex flex-col gap-1">
              {CHOICES.map((c) => {
                const sel = selected === c.id
                const hov = hover === c.id && !sel
                return (
                  <button
                    key={c.id}
                    ref={(el) => {
                      optRefs.current[c.id] = el
                    }}
                    tabIndex={-1}
                    className={`flex min-h-[25px] items-center gap-2 rounded-md border px-2 py-[3px] text-left text-[12.5px] transition-all duration-200 ${
                      sel
                        ? 'border-2 border-[#0e7c75] bg-[#e3f4f1]'
                        : hov
                          ? 'border-[#0e7c75]/70 bg-[rgba(240,253,244,0.9)] shadow-[0_0_0_3px_rgba(14,124,117,0.12)]'
                          : 'border-[#9aa3a1] bg-white'
                    }`}
                  >
                    <span
                      className={`flex size-[17px] shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors duration-200 ${
                        sel ? 'border-[#0e7c75] bg-[#0e7c75] text-white' : hov ? 'border-[#0e7c75] text-[#0e7c75]' : 'border-[#777] text-[#111]'
                      }`}
                    >
                      {c.id}
                    </span>
                    <MathTex tex={c.tex} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="relative z-20 flex h-9 shrink-0 items-center justify-between border-t border-[#d7e7e4] bg-white px-3">
          <span className="text-[11px] font-semibold">Usmon</span>
          <span className="rounded-full bg-[#111] px-2.5 py-0.5 text-[10px] font-semibold text-white">Question 7 of 22</span>
          <span
            ref={nextRef}
            className={`rounded-full bg-[#0e7c75] px-3.5 py-1 text-[10.5px] font-bold text-white transition-transform duration-200 ${
              nextPress ? 'scale-90 bg-[#0b4f4a]' : ''
            }`}
          >
            Next
          </span>
        </div>

        {/* cursor */}
        <div
          className="pointer-events-none absolute left-0 top-0 z-30"
          style={{
            transform: `translate(${cursor.x}px, ${cursor.y}px)`,
            opacity: cursor.show && !fade ? 1 : 0,
            transition: 'transform 760ms cubic-bezier(.45,.05,.25,1), opacity 350ms',
          }}
        >
          <span
            className="absolute -left-3 -top-3 size-6 rounded-full bg-[#0e7c75]/35"
            style={{ transform: cursor.down ? 'scale(1)' : 'scale(0)', opacity: cursor.down ? 1 : 0, transition: 'transform .25s, opacity .35s' }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ transform: cursor.down ? 'scale(.86)' : 'none', transition: 'transform .12s' }}>
            <path d="M4 2l15 9-6.5 1.6L9.5 19 4 2z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <div className="px-4 py-2.5 text-center text-[11.5px] font-semibold text-sp-text-muted">
        {t('Bluebook uslubidagi real imtihon muhiti')}
      </div>
    </div>
  )
}
