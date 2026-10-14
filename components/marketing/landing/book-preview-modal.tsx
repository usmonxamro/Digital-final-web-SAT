'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useContentProtection } from '@/lib/use-content-protection'

const MAX_PREVIEW_PAGES = 8

export function BookPreviewModal({ pdfUrl, onClose }: { pdfUrl: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [pageCount, setPageCount] = useState(0)

  useContentProtection(true)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  useEffect(() => {
    let cancelled = false

    async function renderPages() {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.legacy.min.mjs'

        const doc = await pdfjs.getDocument({ url: pdfUrl }).promise
        const total = Math.min(doc.numPages, MAX_PREVIEW_PAGES)
        if (cancelled) return
        setPageCount(total)

        const container = containerRef.current
        if (!container) return
        container.innerHTML = ''

        for (let i = 1; i <= total; i++) {
          if (cancelled) return
          const page = await doc.getPage(i)
          const viewport = page.getViewport({ scale: 1.4 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = 'w-full h-auto rounded-lg shadow-lg mb-4 select-none pointer-events-none'
          canvas.draggable = false
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await page.render({ canvasContext: ctx, viewport, canvas }).promise
          if (cancelled) return
          container.appendChild(canvas)
        }

        if (!cancelled) setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    renderPages()
    return () => {
      cancelled = true
    }
  }, [pdfUrl])

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col animate-in fade-in duration-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
        <div className="text-white text-[14px] font-bold">
          Kitob ko&apos;rinishi {pageCount > 0 && `— dastlabki ${pageCount} sahifa`}
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          aria-label="Yopish"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 select-none" onContextMenu={(e) => e.preventDefault()}>
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center h-full text-white/70 gap-3">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-[13px]">Yuklanmoqda...</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center justify-center h-full text-white/70 text-[13px]">
            Kitobni yuklab bo&apos;lmadi.
          </div>
        )}
        <div ref={containerRef} className="max-w-[640px] mx-auto" />
        {status === 'ready' && (
          <p className="max-w-[640px] mx-auto text-center text-white/50 text-[12.5px] mt-2">
            To&apos;liq kitobni o&apos;qish uchun Premium&apos;ga o&apos;ting.
          </p>
        )}
      </div>
    </div>
  )
}
