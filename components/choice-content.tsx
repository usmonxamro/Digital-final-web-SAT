'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { Math, MixedText } from '@/components/math'
import type { Choice } from '@/lib/test-data'

/** A picture used as an answer option is drawn at most this big by default (CSS px), kept in proportion.
 *  The admin can make a given option's picture bigger / smaller in the exam preview. */
export const CHOICE_MAX_W = 450
export const CHOICE_MAX_H = 350
const SMALL_MAX_W = 120
const SMALL_MAX_H = 90
export const CHOICE_SCALE_MIN = 0.3
export const CHOICE_SCALE_MAX = 3

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const round2 = (v: number) => globalThis.Math.round(v * 100) / 100

/**
 * The picture of an answer option (a graph / diagram used as choice A–D).
 *
 * Default size: its natural size, shrunk to fit 450 × 350 (never enlarged), × `scale` — the admin's own
 * size for this option. Admin preview (`editable`): a corner handle and − / + set that size (`onScaleChange`).
 */
export function ChoiceImage({
  src,
  scale = 1,
  size = 'md',
  dim,
  editable,
  onScaleChange,
}: {
  src: string
  /** Admin-chosen size multiplier (layout.choiceImg[id].scale). */
  scale?: number
  /** 'sm' = small thumbnail for admin lists. */
  size?: 'sm' | 'md'
  dim?: boolean
  editable?: boolean
  onScaleChange?: (scale: number) => void
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [dragScale, setDragScale] = useState<number | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const limW = size === 'sm' ? SMALL_MAX_W : CHOICE_MAX_W
  const limH = size === 'sm' ? SMALL_MAX_H : CHOICE_MAX_H
  const s = size === 'sm' ? 1 : clamp(dragScale ?? scale, CHOICE_SCALE_MIN, CHOICE_SCALE_MAX)

  let width: number | undefined
  if (natural) {
    const base = natural.w * globalThis.Math.min(1, limW / natural.w, limH / natural.h)
    width = globalThis.Math.round(base * s)
  }

  useEffect(() => {
    setDragScale(null)
    const el = imgRef.current
    if (el?.complete && el.naturalWidth) setNatural({ w: el.naturalWidth, h: el.naturalHeight })
  }, [src])

  const resize = useRef<{ x: number; w: number; s: number } | null>(null)
  function onResizeStart(e: React.PointerEvent) {
    if (!width) return
    e.preventDefault()
    e.stopPropagation()
    resize.current = { x: e.clientX, w: width, s }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onResizeMove(e: React.PointerEvent) {
    const r = resize.current
    if (!r) return
    const nextW = globalThis.Math.max(40, r.w + (e.clientX - r.x))
    setDragScale(round2(clamp((r.s * nextW) / r.w, CHOICE_SCALE_MIN, CHOICE_SCALE_MAX)))
  }
  function onResizeEnd() {
    if (!resize.current) return
    resize.current = null
    if (dragScale != null && dragScale !== scale) onScaleChange?.(dragScale)
    setDragScale(null)
  }
  function step(dir: 1 | -1) {
    onScaleChange?.(round2(clamp(s + dir * 0.1, CHOICE_SCALE_MIN, CHOICE_SCALE_MAX)))
  }
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <span className="relative inline-block max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt="Javob varianti rasmi"
          draggable={false}
          onLoad={(e) =>
            setNatural({ w: e.currentTarget.naturalWidth || limW, h: e.currentTarget.naturalHeight || limH })
          }
          style={{ width: width ? `${width}px` : undefined, maxWidth: '100%', height: 'auto', maxHeight: width ? undefined : limH }}
          className={`block select-none object-contain ${dim ? 'opacity-40' : ''}`}
        />
        {editable && (
          <span
            role="slider"
            aria-label="Javob rasmi o'lchami"
            aria-valuenow={globalThis.Math.round(s * 100)}
            title="Sudrab rasm o'lchamini belgilang"
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            onPointerCancel={onResizeEnd}
            onClick={stop}
            className="absolute -bottom-1.5 -right-1.5 size-4 cursor-nwse-resize rounded-sm border-2 border-white bg-[#0e7c75] shadow"
          />
        )}
      </span>
      {editable && (
        // Spans, not buttons: this sits inside the answer's own <button>.
        <span className="inline-flex items-center gap-1 text-[#0b4f4a]" onClick={stop} onPointerDown={stop}>
          <MiniBtn label="Kichraytirish" onClick={() => step(-1)}>
            <Minus className="size-3" />
          </MiniBtn>
          <span className="min-w-[38px] text-center font-sans text-[10.5px] font-bold">{globalThis.Math.round(s * 100)}%</span>
          <MiniBtn label="Kattalashtirish" onClick={() => step(1)}>
            <Plus className="size-3" />
          </MiniBtn>
          {globalThis.Math.abs(s - 1) > 0.001 && (
            <MiniBtn label="Standart o‘lcham" onClick={() => onScaleChange?.(1)}>
              <RotateCcw className="size-3" />
            </MiniBtn>
          )}
        </span>
      )}
    </span>
  )
}

function MiniBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.stopPropagation(), onClick())}
      className="flex size-5 cursor-pointer items-center justify-center rounded-full bg-white/95 shadow-sm ring-1 ring-[#c7d6d4] hover:bg-[#e3f4f1]"
    >
      {children}
    </span>
  )
}

/** What is written inside an answer option: its picture (if any) above its text / formula (if any). */
export function ChoiceContent({
  choice,
  size = 'md',
  dim,
  scale,
  editable,
  onScaleChange,
}: {
  choice: Choice
  size?: 'sm' | 'md'
  dim?: boolean
  scale?: number
  editable?: boolean
  onScaleChange?: (scale: number) => void
}) {
  return (
    <span className="flex min-w-0 max-w-full flex-col items-start gap-1.5">
      {choice.image && (
        <ChoiceImage src={choice.image} size={size} dim={dim} scale={scale} editable={editable} onScaleChange={onScaleChange} />
      )}
      {choice.tex ? <Math tex={choice.tex} /> : choice.text ? <MixedText text={choice.text} /> : null}
    </span>
  )
}
