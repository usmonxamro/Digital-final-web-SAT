'use client'

import { useEffect, useRef, useState } from 'react'

export function BookCover({ pdfUrl, className = '' }: { pdfUrl: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const doc = await pdfjs.getDocument({ url: pdfUrl }).promise
        const page = await doc.getPage(1)
        const viewport = page.getViewport({ scale: 1.6 })

        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        if (!cancelled) setLoaded(true)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [pdfUrl])

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {failed && (
        <div className="w-full h-full flex items-center justify-center text-[12px] text-sp-text-muted bg-sp-input">
          Kitob muqovasi yuklanmadi
        </div>
      )}
      <canvas
        ref={canvasRef}
        draggable={false}
        className={`w-full h-full object-cover pointer-events-none transition-opacity duration-500 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
