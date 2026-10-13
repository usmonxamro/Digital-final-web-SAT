'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

type ExamFooterProps = {
  current: number
  total: number
  sectionLabel: string
  userName: string
  answered: Record<number, boolean>
  flagged: Record<number, boolean>
  onNavigate: (index: number) => void
  onBack: () => void
  onNext: () => void
  nextLabel?: string
}

export function ExamFooter({
  current,
  total,
  sectionLabel,
  userName,
  answered,
  flagged,
  onNavigate,
  onBack,
  onNext,
  nextLabel,
}: ExamFooterProps) {
  const [gridOpen, setGridOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setGridOpen(false)
    }
    if (gridOpen) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [gridOpen])

  return (
    <footer className="sticky bottom-0 z-30 border-t border-[#d7e7e4] bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6">
        {/* User name (left) */}
        <div className="min-w-0">
          <span className="truncate text-[15px] font-semibold text-[#111]">{userName}</span>
        </div>

        {/* Progress + nav popup (center) */}
        <div className="relative flex justify-center" ref={ref}>
          <button
            type="button"
            onClick={() => setGridOpen((o) => !o)}
            aria-expanded={gridOpen}
            className="flex items-center gap-1.5 rounded-full bg-[#111] px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#2b2b2b] sm:gap-2 sm:px-4 sm:text-[13.5px]"
          >
            <span className="sm:hidden">
              {current + 1}/{total}
            </span>
            <span className="hidden sm:inline">
              Question {current + 1} of {total}
            </span>
            <ChevronDown className={`size-3.5 transition-transform ${gridOpen ? 'rotate-180' : ''}`} />
          </button>

          {gridOpen && (
            <div className="absolute bottom-full left-1/2 mb-3 w-[min(24rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-lg border border-[#c7d6d4] bg-white p-4 shadow-xl">
              <div className="mb-3 text-[13.5px] font-bold text-[#0b4f4a]">{sectionLabel}</div>

              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-[#444]">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full border-[1.5px] border-[#111] bg-white" /> Current
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full border-[1.5px] border-dashed border-[#767676] bg-white" /> Unanswered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full bg-[#0e7c75]" /> Answered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-3 bg-[#c8102e]" style={{ clipPath: 'polygon(0 0,100% 0,100% 60%,50% 100%,0 60%)' }} />
                  For Review
                </span>
              </div>

              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
                {Array.from({ length: total }).map((_, i) => {
                  const isCurrent = i === current
                  const isAnswered = answered[i]
                  const isFlagged = flagged[i]
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onNavigate(i)
                        setGridOpen(false)
                      }}
                      className={`relative flex size-8 items-center justify-center rounded-sm border-[1.5px] text-[12.5px] font-semibold transition-colors sm:size-9 sm:text-[13px] ${
                        isCurrent
                          ? 'border-[#111] bg-white text-[#111]'
                          : isAnswered
                            ? 'border-[#0e7c75] bg-[#0e7c75] text-white'
                            : 'border-dashed border-[#767676] bg-white text-[#444] hover:border-[#0e7c75]'
                      }`}
                    >
                      {i + 1}
                      {isFlagged && (
                        <span
                          className="absolute -right-1 -top-1 size-[11px] bg-[#c8102e]"
                          style={{ clipPath: 'polygon(0 0,100% 0,100% 60%,50% 100%,0 60%)' }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => setGridOpen(false)}
                className="mt-3 w-full rounded-full border border-[#0e7c75] py-1.5 text-center text-[12.5px] font-semibold text-[#0e7c75] hover:bg-[#d2ebe7]"
              >
                Go to Review Page
              </button>
            </div>
          )}
        </div>

        {/* Nav buttons (right) */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={current === 0}
            className="flex items-center gap-1 rounded-full border-[1.5px] border-[#0e7c75] bg-white px-3.5 py-1.5 text-[13.5px] font-semibold text-[#0e7c75] transition-colors hover:bg-[#d2ebe7] disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-1 rounded-full bg-[#0e7c75] px-3.5 py-1.5 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0a625c] sm:px-4"
          >
            <span className="hidden sm:inline">{nextLabel ?? (current >= total - 1 ? 'Finish' : 'Next')}</span>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </footer>
  )
}
