'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Highlighter, LogOut, Maximize, MoreVertical, StickyNote } from 'lucide-react'

function formatTime(totalSeconds: number) {
  // Negative = overtime (the student chose to keep working after the time ran out).
  const neg = totalSeconds < 0
  const abs = Math.abs(totalSeconds)
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${neg ? '−' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

type ExamHeaderProps = {
  label: string
  seconds: number
  /** Stopwatch (tasks): counts up, never turns red. */
  countUp?: boolean
  /** The time ran out and the student kept going — the clock shows minus time. */
  overtime?: boolean
  /** Show Calculator + Reference tools (math modules only). */
  mathTools: boolean
  calculatorOpen: boolean
  referenceOpen: boolean
  onToggleCalculator: () => void
  onToggleReference: () => void
  /** Wraps the current text selection (inside the passage) in a highlight. No-op outside Reading. */
  onHighlight?: () => void
  onExit?: () => void
}

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])
  return { open, setOpen, ref }
}

export function ExamHeader({
  label,
  seconds,
  countUp = false,
  overtime = false,
  mathTools,
  calculatorOpen,
  referenceOpen,
  onToggleCalculator,
  onToggleReference,
  onHighlight,
  onExit,
}: ExamHeaderProps) {
  const [hidden, setHidden] = useState(false)
  const low = !countUp && seconds <= 60
  const dir = usePopover()
  const more = usePopover()

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
    more.setOpen(false)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#d7e7e4] bg-[#e7f3f1]">
      {/* Main row — one compact line on phones too (title+Directions | timer | tools). */}
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-1.5 sm:flex sm:justify-between sm:gap-x-2 sm:px-6 sm:py-2.5">
        {/* Left: title + directions */}
        <div ref={dir.ref} className="relative flex min-w-0 flex-1 flex-col sm:flex-none">
          <h1 className="truncate text-[12.5px] font-bold leading-tight tracking-tight text-[#0b4f4a] sm:text-[15px]">{label}</h1>
          <button
            type="button"
            onClick={() => dir.setOpen((o) => !o)}
            aria-expanded={dir.open}
            className="flex w-fit items-center gap-1 text-[11.5px] font-semibold leading-tight text-[#0e7c75] sm:mt-0.5 sm:text-[13px] hover:text-[#0a625c]"
          >
            Directions
            <ChevronDown className={`size-3.5 transition-transform ${dir.open ? 'rotate-180' : ''}`} />
          </button>

          {dir.open && (
            <div className="absolute left-0 top-full z-40 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-[#c7d6d4] bg-white p-4 text-[13.5px] leading-relaxed text-[#1a1a1a] shadow-xl">
              <p className="mb-2 font-bold text-[#0b4f4a]">Directions</p>
              <p>
                Ushbu bo&apos;limdagi savollar bilan tanishib chiqing. Har bir savolga javob
                bering va &quot;Next&quot; tugmasini bosing. Kerak bo&apos;lsa &quot;Back&quot;
                tugmasi orqali oldingi savolga qaytishingiz mumkin. Javobingizga aniq ishonmasangiz,
                &quot;Mark for Review&quot; tugmasi bilan belgilab qo&apos;yib, modul oxirida
                qaytib ko&apos;rib chiqishingiz mumkin. Modul vaqti tugaganda u avtomatik
                yakunlanadi — shuning uchun vaqtni nazorat qiling.
              </p>
            </div>
          )}
        </div>

        {/* Center: timer + hide — inline between title and tools on phones, absolutely centered from sm up. */}
        <div className="flex shrink-0 flex-col items-center sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
          <span className={`text-[15px] font-bold leading-tight tabular-nums tracking-wide sm:text-[22px] ${low ? 'text-red-600' : 'text-[#111]'}`}>
            {hidden ? '••:••' : formatTime(seconds)}
          </span>
          {overtime && !hidden && (
            <span className="text-[10px] font-bold uppercase leading-tight tracking-wide text-red-600 sm:text-[11px]">Qo&apos;shimcha vaqt</span>
          )}
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            className="rounded-full border border-[#0e7c75]/40 px-2.5 text-[10px] font-semibold leading-[15px] text-[#0e7c75] transition-colors hover:bg-[#d2ebe7] sm:mt-0.5 sm:px-3 sm:py-0.5 sm:text-[11.5px] sm:leading-normal"
          >
            {hidden ? 'Show' : 'Hide'}
          </button>
        </div>

        {/* Right: tools */}
        <div className="flex items-center justify-end gap-3 sm:gap-5">
          {mathTools && (
            <>
              <button
                type="button"
                onClick={onToggleCalculator}
                aria-pressed={calculatorOpen}
                aria-label="Calculator"
                className={`flex flex-col items-center gap-0.5 text-[10.5px] font-semibold transition-colors sm:text-[11.5px] ${
                  calculatorOpen ? 'text-[#0b4f4a]' : 'text-[#375957] hover:text-[#0b4f4a]'
                }`}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="sm:w-5 sm:h-5">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <path d="M8 6h8M7 11h2M11 11h2M15 11h2M7 15h2M11 15h2M15 15h2M7 19h2M11 19h2" strokeLinecap="round" />
                </svg>
                <span className="hidden sm:inline">Calculator</span>
              </button>
              <button
                type="button"
                onClick={onToggleReference}
                aria-pressed={referenceOpen}
                aria-label="Reference"
                className={`flex flex-col items-center gap-0.5 text-[10.5px] font-semibold transition-colors sm:text-[11.5px] ${
                  referenceOpen ? 'text-[#0b4f4a]' : 'text-[#375957] hover:text-[#0b4f4a]'
                }`}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="sm:w-5 sm:h-5">
                  <path d="M4 19V6a2 2 0 0 1 2-2h8l6 6v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                  <path d="M14 4v6h6" />
                </svg>
                <span className="hidden sm:inline">Reference</span>
              </button>
            </>
          )}

          {!mathTools && (
            <button
              type="button"
              onClick={onHighlight}
              className="flex flex-col items-center gap-0.5 text-[10.5px] font-semibold text-[#375957] transition-colors hover:text-[#0b4f4a] sm:text-[11.5px]"
            >
              <span className="flex items-center gap-0.5">
                <Highlighter className="size-4 sm:size-[18px]" />
                <StickyNote className="size-3 sm:size-[14px]" />
              </span>
              <span className="hidden sm:inline">Highlights &amp; Notes</span>
            </button>
          )}

          <div ref={more.ref} className="relative">
            <button
              type="button"
              onClick={() => more.setOpen((o) => !o)}
              aria-expanded={more.open}
              className="flex flex-col items-center gap-0.5 text-[10.5px] font-semibold text-[#375957] transition-colors hover:text-[#0b4f4a] sm:text-[11.5px]"
            >
              <MoreVertical className="size-4 sm:size-5" />
              <span className="hidden sm:inline">More</span>
            </button>

            {more.open && (
              <div className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-lg border border-[#c7d6d4] bg-white py-1 shadow-xl">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] font-medium text-[#1a1a1a] hover:bg-[#d2ebe7]"
                >
                  <Maximize className="size-4" /> Fullscreen
                </button>
                {onExit && (
                  <button
                    type="button"
                    onClick={() => {
                      more.setOpen(false)
                      onExit()
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] font-medium text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="size-4" /> Exit test
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dashed separator */}
      <div
        className="h-[2px] sm:h-[3px]"
        style={{ backgroundImage: 'repeating-linear-gradient(90deg,#111 0 20px,transparent 20px 26px)' }}
      />

      {/* Practice test banner — a hairline strip on phones, the full bar from sm up */}
      <div className="px-4 sm:px-10 sm:py-1">
        <div className="rounded-b-md bg-[#0b4f4a] py-px text-center text-[8.5px] font-bold uppercase leading-[13px] tracking-wider text-white sm:rounded-b-xl sm:py-1 sm:text-[11.5px] sm:leading-normal">
          This is a practice test
        </div>
      </div>
    </header>
  )
}
