'use client'

import { Math, MixedText } from '@/components/math'
import type { Choice } from '@/lib/test-data'

type OptionCardProps = {
  option: Choice
  selected: boolean
  eliminated: boolean
  crossOutMode: boolean
  /** Reading & Writing keeps the serif face of the passage; Math uses Inter. */
  serif?: boolean
  onSelect: () => void
  onToggleEliminate: () => void
}

export function OptionCard({
  option,
  selected,
  eliminated,
  crossOutMode,
  serif = false,
  onSelect,
  onToggleEliminate,
}: OptionCardProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={eliminated ? undefined : onSelect}
        disabled={eliminated}
        className={`group flex min-h-[42px] flex-1 items-center gap-3 rounded-lg border-[1.5px] px-3 py-2 sm:min-h-[47px] sm:gap-3.5 sm:px-3.5 sm:py-2.5 text-left ${serif ? 'font-serif' : 'font-sans'} transition-colors duration-150 ${
          selected
            ? 'border-2 border-[#0e7c75] bg-[#e3f4f1]'
            : eliminated
              ? 'border-dashed border-[#9b9b9b] bg-white'
              : 'border-[#777] bg-white hover:border-[#0e7c75]/60 hover:bg-[#f3fbf9]'
        }`}
      >
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] font-sans text-sm font-bold transition-colors duration-150 ${
            selected
              ? 'border-[#0e7c75] bg-[#0e7c75] text-white'
              : eliminated
                ? 'border-[#9b9b9b] text-[#9b9b9b]'
                : 'border-[#777] text-[#111] group-hover:border-[#0e7c75]'
          }`}
        >
          {option.id}
        </span>
        <span
          className="text-[14.5px] leading-[1.45] sm:text-[15.5px] sm:leading-relaxed"
          style={
            eliminated
              ? {
                  color: '#9b9b9b',
                  textDecorationLine: 'line-through',
                  textDecorationColor: '#767676',
                  textDecorationThickness: '1.5px',
                }
              : { color: '#111' }
          }
        >
          {option.tex ? <Math tex={option.tex} /> : <MixedText text={option.text ?? ''} />}
        </span>
      </button>

      {crossOutMode && (
        <button
          type="button"
          onClick={onToggleEliminate}
          aria-label={eliminated ? `Undo eliminate answer ${option.id}` : `Eliminate answer ${option.id}`}
          className="relative flex size-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors"
        >
          {eliminated ? (
            <span className="font-sans font-bold text-[#0e7c75] underline">Undo</span>
          ) : (
            <span className="relative flex size-[22px] items-center justify-center rounded-full border border-[#767676] text-[#767676]">
              {option.id}
              <span className="pointer-events-none absolute inset-x-[2px] top-1/2 h-px -translate-y-1/2 -rotate-[20deg] bg-[#767676]" />
            </span>
          )}
        </button>
      )}
    </div>
  )
}
