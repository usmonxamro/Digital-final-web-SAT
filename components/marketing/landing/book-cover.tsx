'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Book cover, tried in this order (so it never shows an error message):
 *  1. a ready image  `public/book-cover.jpg`  (lightest, works on every phone) — optional
 *  2. page 1 of the book PDF rendered with pdf.js
 *  3. a designed cover drawn in CSS
 */
export function BookCover({ pdfUrl, coverUrl = '/book-cover.jpg', className = '' }: { pdfUrl: string; coverUrl?: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stage, setStage] = useState<'image' | 'pdf' | 'css'>('image')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (stage !== 'pdf') return
    let cancelled = false
    const giveUp = setTimeout(() => !cancelled && setStage('css'), 12000)

    async function render() {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.legacy.min.mjs'
        const doc = await pdfjs.getDocument({ url: pdfUrl }).promise
        const page = await doc.getPage(1)
        const viewport = page.getViewport({ scale: 1.2 })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no 2d context')
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        if (!cancelled) {
          clearTimeout(giveUp)
          setLoaded(true)
        }
      } catch {
        if (!cancelled) setStage('css')
      }
    }
    render()
    return () => {
      cancelled = true
      clearTimeout(giveUp)
    }
  }, [stage, pdfUrl])

  return (
    <div className={`relative overflow-hidden select-none ${className}`} onContextMenu={(e) => e.preventDefault()}>
      {stage === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          draggable={false}
          onError={() => setStage('pdf')}
          className="w-full h-full object-cover pointer-events-none"
        />
      )}
      {stage === 'pdf' && (
        <canvas
          ref={canvasRef}
          draggable={false}
          className={`w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {(stage === 'css' || (stage === 'pdf' && !loaded)) && <DesignedCover />}
    </div>
  )
}

/** Stand-in cover (shown while the PDF renders, or when no book file is uploaded yet). */
function DesignedCover() {
  return (
    <div className="absolute inset-0 flex flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,#0b3d36_0%,#0e7c75_55%,#10b981_120%)] p-3 text-white">
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -left-8 size-28 rounded-full bg-[#f59e0b]/25" />
      <span className="relative text-[8.5px] font-bold tracking-[0.18em] text-white/80">DIGITAL</span>
      <div className="relative">
        <div className="text-[34px] font-extrabold leading-none tracking-tight">SAT</div>
        <div className="mt-1 h-[3px] w-9 rounded bg-[#f59e0b]" />
        <div className="mt-1.5 text-[10px] font-semibold leading-tight text-white/90">Strategiya va misollar</div>
      </div>
      <span className="relative text-[9px] font-bold tracking-wide text-white/85">Usmon Xamroyev</span>
    </div>
  )
}
