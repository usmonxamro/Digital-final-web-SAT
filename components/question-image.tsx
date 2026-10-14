'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'

/** Longest a figure is drawn inline by default, in CSS px — real Bluebook
 *  figures are compact; a screenshot dropped in at full size looked oversized. */
const MAX_INLINE_W = 400
const MAX_INLINE_H = 280

/** Student zoom range (× the default size). */
const ZOOM_MIN = 0.5
const ZOOM_MAX = 4
/** Admin default-size range (× the automatic size). */
export const ADMIN_SCALE_MIN = 0.3
export const ADMIN_SCALE_MAX = 3

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round2 = (v: number) => Math.round(v * 100) / 100

/**
 * A question figure.
 *
 * Default size: natural width ÷ devicePixelRatio (how big the screenshot
 * looked where it was captured), capped at MAX_INLINE_W × MAX_INLINE_H, then
 * × `scale` — the admin's own default size, set in the exam preview.
 *
 * Students: hover the figure and turn the mouse wheel to zoom it in place, or
 * use the small − / + stacked in a column at its right. A zoomed figure bigger than
 * the column can be dragged to pan.
 *
 * Admin preview (`editable`): no student zoom — instead a corner handle (and
 * the − / + buttons) set the default size, reported through onScaleChange.
 */
export function QuestionImage({
  src,
  scale = 1,
  editable,
  onScaleChange,
}: {
  src: string
  /** Admin-chosen default size multiplier (layout.img.scale). */
  scale?: number
  editable?: boolean
  onScaleChange?: (scale: number) => void
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  // Live value while the admin drags the resize handle (committed on release).
  const [dragScale, setDragScale] = useState<number | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const adminScale = clamp(dragScale ?? scale, ADMIN_SCALE_MIN, ADMIN_SCALE_MAX)

  // NOT the viewer's devicePixelRatio: a 3× phone used to draw every figure three times smaller than a
  // 1× laptop, so figures looked tiny on phones. The same fixed size everywhere, capped by the column width.
  const dpr = 1
  let baseW: number | undefined
  if (natural) {
    const cssW = natural.w / dpr
    const cssH = natural.h / dpr
    baseW = cssW * Math.min(1, MAX_INLINE_W / cssW, MAX_INLINE_H / cssH)
  }
  const width = baseW ? Math.round(baseW * adminScale * (editable ? 1 : zoom)) : undefined

  // New figure → back to its default size. A cached image can finish loading
  // before React attaches onLoad (during hydration), so read it directly too.
  useEffect(() => {
    setZoom(1)
    setDragScale(null)
    const el = imgRef.current
    if (el?.complete && el.naturalWidth) setNatural({ w: el.naturalWidth, h: el.naturalHeight })
  }, [src])

  // Hover + mouse wheel = zoom. Needs a non-passive listener to stop the page
  // from scrolling; at the zoom limit the wheel scrolls the page as usual.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || editable) return
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey && Math.abs(e.deltaY) < 1) return
      const z = zoomRef.current
      const next = clamp(z * Math.exp(-e.deltaY * 0.0022), ZOOM_MIN, ZOOM_MAX)
      if (Math.abs(next - z) < 0.001) return // at the limit: let the page scroll
      e.preventDefault()
      setZoom(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [editable])

  /* ------------------------------ drag to pan ------------------------------ */
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null)
  function onPanStart(e: React.PointerEvent) {
    const el = scrollerRef.current
    if (!el || editable) return
    if (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return
    pan.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
    el.setPointerCapture(e.pointerId)
  }
  function onPanMove(e: React.PointerEvent) {
    const el = scrollerRef.current
    if (!el || !pan.current) return
    el.scrollLeft = pan.current.sl - (e.clientX - pan.current.x)
    el.scrollTop = pan.current.st - (e.clientY - pan.current.y)
  }
  function onPanEnd() {
    pan.current = null
  }

  /* --------------------------- admin resize handle -------------------------- */
  const resize = useRef<{ x: number; w: number; s: number } | null>(null)
  function onResizeStart(e: React.PointerEvent) {
    if (!width) return
    e.preventDefault()
    e.stopPropagation()
    resize.current = { x: e.clientX, w: width, s: adminScale }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onResizeMove(e: React.PointerEvent) {
    const r = resize.current
    if (!r) return
    const nextW = Math.max(40, r.w + (e.clientX - r.x))
    setDragScale(round2(clamp((r.s * nextW) / r.w, ADMIN_SCALE_MIN, ADMIN_SCALE_MAX)))
  }
  function onResizeEnd() {
    if (!resize.current) return
    resize.current = null
    if (dragScale != null && dragScale !== scale) onScaleChange?.(dragScale)
    setDragScale(null)
  }

  function step(dir: 1 | -1) {
    if (editable) {
      onScaleChange?.(round2(clamp(adminScale + dir * 0.1, ADMIN_SCALE_MIN, ADMIN_SCALE_MAX)))
    } else {
      setZoom((z) => clamp(z * (dir === 1 ? 1.25 : 0.8), ZOOM_MIN, ZOOM_MAX))
    }
  }

  const changed = editable ? Math.abs(adminScale - 1) > 0.001 : Math.abs(zoom - 1) > 0.001
  const pct = Math.round((editable ? adminScale : zoom) * 100)

  return (
    <div className="my-5 flex justify-center">
      <div className="group/img flex max-w-full items-start gap-1.5">
       <div className="relative min-w-0 max-w-full">
        <div
          ref={scrollerRef}
          onPointerDown={onPanStart}
          onPointerMove={onPanMove}
          onPointerUp={onPanEnd}
          onPointerCancel={onPanEnd}
          className={`max-w-full overflow-auto [scrollbar-width:thin] ${!editable && zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={{ maxHeight: editable ? undefined : '70vh' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt="Savolga tegishli rasm"
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{
              width: width ? `${width}px` : undefined,
              maxWidth: editable || zoom <= 1 ? '100%' : 'none',
              height: 'auto',
            }}
            className="block select-none object-contain"
            // Students: no ghost-image drag (drag = pan). Admin preview: let the
            // drag bubble up so the whole figure block can be moved.
            draggable={editable ? undefined : false}
          />
        </div>

        {/* Admin: drag the corner to set the default size */}
        {editable && (
          <span
            data-nodrag
            role="slider"
            aria-label="Rasm o'lchami"
            aria-valuenow={pct}
            title="Sudrab rasm o'lchamini belgilang"
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            onPointerCancel={onResizeEnd}
            draggable={false}
            onDragStart={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            className="absolute -bottom-1.5 -right-1.5 size-4 cursor-nwse-resize rounded-sm border-2 border-white bg-[#0e7c75] shadow"
          />
        )}
      </div>
        {/* − / + stacked in a column at the right, beside the figure (never over it) */}
        <div
          className={`flex shrink-0 flex-col items-center gap-1 transition-opacity ${
            editable ? 'opacity-100' : 'opacity-60 hover:opacity-100 group-hover/img:opacity-100'
          }`}
          data-nodrag
          onPointerDown={(e) => e.stopPropagation()}
          draggable={false}
          onDragStart={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <ZoomBtn label="Kattalashtirish" onClick={() => step(1)}>
            <Plus className="size-3.5" />
          </ZoomBtn>
          <ZoomBtn label="Kichraytirish" onClick={() => step(-1)}>
            <Minus className="size-3.5" />
          </ZoomBtn>
          {(changed || editable) && (
            <span className="rounded-full bg-white/95 px-1.5 py-0.5 text-[10.5px] font-bold text-[#0b4f4a] shadow-sm ring-1 ring-[#c7d6d4]">
              {pct}%
            </span>
          )}
          {changed && (
            <ZoomBtn
              label={editable ? 'Standart o‘lcham' : 'Asl o‘lcham'}
              onClick={() => (editable ? onScaleChange?.(1) : setZoom(1))}
            >
              <RotateCcw className="size-3" />
            </ZoomBtn>
          )}
        </div>
      </div>
    </div>
  )
}

function ZoomBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-6 items-center justify-center rounded-full bg-white/95 text-[#0b4f4a] shadow-sm ring-1 ring-[#c7d6d4] hover:bg-[#e3f4f1]"
    >
      {children}
    </button>
  )
}
