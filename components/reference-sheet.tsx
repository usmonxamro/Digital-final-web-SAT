'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Math as MathTex } from '@/components/math'
import { useIsMobile } from '@/lib/use-is-mobile'

const FORMULAS: { tex: string; label: string }[] = [
  { tex: 'A = \\pi r^2', label: 'Circle area' },
  { tex: 'C = 2\\pi r', label: 'Circle circumference' },
  { tex: 'A = \\ell w', label: 'Rectangle area' },
  { tex: 'A = \\dfrac{1}{2}bh', label: 'Triangle area' },
  { tex: 'c^2 = a^2 + b^2', label: 'Pythagorean theorem' },
  { tex: 'V = \\ell w h', label: 'Rectangular prism volume' },
  { tex: 'V = \\pi r^2 h', label: 'Cylinder volume' },
  { tex: 'V = \\dfrac{4}{3}\\pi r^3', label: 'Sphere volume' },
  { tex: 'V = \\dfrac{1}{3}\\pi r^2 h', label: 'Cone volume' },
  { tex: 'V = \\dfrac{1}{3}\\ell w h', label: 'Pyramid volume' },
]

const NOTES = [
  'The number of degrees of arc in a circle is 360.',
  'The number of radians of arc in a circle is 2π.',
  'The sum of the measures in degrees of the angles of a triangle is 180.',
]

export const REFERENCE_DEFAULT_WIDTH = 400
const MIN_W = 300
/** Gap between the shifted question text and the panel. */
export const REFERENCE_GAP = 16

function Content() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 p-4">
        {FORMULAS.map((f) => (
          <div
            key={f.label}
            className="flex flex-col items-center gap-1 rounded-sm border border-[#d4d4d4] bg-[#fafafa] px-2 py-3 text-center"
          >
            <MathTex tex={f.tex} display className="text-[#111]" />
            <span className="text-[11px] text-[#555]">{f.label}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1.5 border-t border-[#e5e5e5] px-4 py-3 text-[12.5px] leading-relaxed text-[#333]">
        {NOTES.map((n) => (
          <p key={n}>{n}</p>
        ))}
      </div>
    </>
  )
}

/**
 * Bluebook-style reference sheet. Desktop: docked on the RIGHT, full height
 * down to the footer (the page shifts the question text left of it), dark
 * title bar like the calculator, and the left edge can be dragged to make it
 * wider / narrower. Mobile: a bottom sheet.
 */
export function ReferenceSheet({
  open,
  onClose,
  bottomOffset = 0,
  onWidthChange,
}: {
  open: boolean
  onClose: () => void
  bottomOffset?: number
  /** Reports the panel width (after a resize ends), so the page can shift the text. */
  onWidthChange?: (width: number) => void
}) {
  const isMobile = useIsMobile()
  const [width, setWidth] = useState(REFERENCE_DEFAULT_WIDTH)
  const [resizing, setResizing] = useState(false)
  const drag = useRef<{ x: number; w: number } | null>(null)

  useEffect(() => {
    if (!resizing) onWidthChange?.(width)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, resizing])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const header = (
    <div className="flex h-[50px] shrink-0 items-center justify-between bg-[#1e1e1e] px-4">
      <span className="text-[15px] font-bold text-white">Reference</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close reference sheet"
        className="rounded p-1 text-white/90 transition-colors hover:bg-white/15 hover:text-white"
      >
        <X className="size-6" strokeWidth={1.8} />
      </button>
    </div>
  )

  if (isMobile) {
    return (
      <div
        className="fixed inset-x-0 z-40 flex flex-col overflow-hidden rounded-t-xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.3)] transition-transform duration-[600ms] ease-in-out"
        style={{
          height: '60dvh',
          bottom: bottomOffset,
          transform: open ? 'translateY(0)' : `translateY(calc(100% + ${bottomOffset}px))`,
          pointerEvents: open ? 'auto' : 'none',
        }}
        role="dialog"
        aria-label="Reference sheet"
        aria-hidden={!open}
      >
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Content />
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed right-0 top-0 z-40 flex flex-col border-l border-[#b9b9b9] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.18)]"
      style={{
        width,
        bottom: bottomOffset,
        opacity: open ? 1 : 0,
        transform: open ? 'translateX(0)' : 'translateX(12px)',
        transition: resizing ? 'none' : 'opacity 600ms ease-in-out, transform 600ms ease-in-out',
        pointerEvents: open ? 'auto' : 'none',
        visibility: open ? 'visible' : 'hidden',
      }}
      role="dialog"
      aria-label="Reference sheet"
      aria-hidden={!open}
    >
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Content />
      </div>

      {/* Left edge: drag to resize */}
      <div
        role="separator"
        aria-label="Resize reference sheet"
        title="Kengligini o'zgartirish — sudrang"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, w: width }
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          setResizing(true)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const next = drag.current.w - (e.clientX - drag.current.x)
          setWidth(Math.round(Math.min(window.innerWidth * 0.55, Math.max(MIN_W, next))))
        }}
        onPointerUp={() => {
          drag.current = null
          setResizing(false)
        }}
        onPointerCancel={() => {
          drag.current = null
          setResizing(false)
        }}
        className="group absolute -left-1.5 top-[50px] bottom-0 flex w-3 cursor-ew-resize touch-none items-center justify-center"
      >
        <span className="h-10 w-1 rounded-full bg-[#9a9a9a] opacity-60 transition-opacity group-hover:opacity-100" />
      </div>
    </div>
  )
}
