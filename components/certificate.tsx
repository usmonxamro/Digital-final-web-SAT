'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildCertificatePdf } from '@/lib/certificate-pdf'
import { useIsMobile } from '@/lib/use-is-mobile'
import type { SectionResult } from '@/lib/scoring'
import type { ReviewItem } from '@/components/score-report'

type CertificateProps = {
  studentName: string
  testTitle: string
  composite: number
  rw: SectionResult
  math: SectionResult
  review: ReviewItem[]
  onClose: () => void
}

export function Certificate({ studentName, testTitle, composite, rw, math, review, onClose }: CertificateProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const urlRef = useRef<string | null>(null)
  const isMobile = useIsMobile()
  // Phones can't show a PDF inside an <iframe>, so the pages are drawn as images instead.
  const [pages, setPages] = useState<string[] | null>(null)
  const blobRef = useRef<Blob | null>(null)

  useEffect(() => {
    let cancelled = false

    async function generate() {
      try {
        const doc = await buildCertificatePdf({ studentName, testTitle, composite, rw, math, review })
        if (cancelled) return
        const blob = doc.output('blob')
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        setPdfUrl(url)
      } catch (err) {
        console.error('Certificate generation failed', err)
        if (!cancelled) setError(true)
      }
    }

    generate()
    return () => {
      cancelled = true
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isMobile || !pdfUrl || pages || !blobRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.legacy.min.mjs'
        const data = new Uint8Array(await blobRef.current!.arrayBuffer())
        const doc = await pdfjs.getDocument({ data, standardFontDataUrl: '/pdf-fonts/', useSystemFonts: true }).promise
        const out: string[] = []
        const scale = Math.min(2, (window.devicePixelRatio || 1) * 1.2)
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          const vp = page.getViewport({ scale: scale * (Math.min(window.innerWidth, 600) / page.getViewport({ scale: 1 }).width) })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(vp.width)
          canvas.height = Math.floor(vp.height)
          await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
          out.push(canvas.toDataURL('image/jpeg', 0.92))
          if (cancelled) return
        }
        if (!cancelled) setPages(out)
      } catch (err) {
        console.error('Certificate preview failed', err)
        if (!cancelled) setPages([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isMobile, pdfUrl, pages])

  function handleDownload() {
    if (!pdfUrl) return
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = `SAT_AKADEMIYASI_Sertifikat_${studentName.replace(/\s+/g, '_')}.pdf`
    link.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="flex w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl" style={{ height: '85vh' }}>
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-3">
          <span className="text-sm font-bold text-[#0f172a]">Sizning Sertifikatingiz</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#64748b] transition-colors hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 bg-slate-100">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-red-600">
              Sertifikatni yaratishda xatolik yuz berdi. Iltimos, qaytadan urinib ko&apos;ring.
            </div>
          ) : pdfUrl && isMobile ? (
            pages && pages.length ? (
              <div className="h-full space-y-2 overflow-y-auto p-2">
                {pages.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={`Sertifikat ${i + 1}`} className="w-full rounded bg-white shadow" />
                ))}
              </div>
            ) : pages ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#64748b]">
                Ko&apos;rish imkoni bo&apos;lmadi — pastdagi “PDF yuklab olish” tugmasini bosing.
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-[#64748b]">
                <Loader2 className="size-6 animate-spin text-[#22c55e]" />
                Sertifikat tayyorlanmoqda...
              </div>
            )
          ) : pdfUrl ? (
            <iframe src={pdfUrl} title="Sertifikat" className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-[#64748b]">
              <Loader2 className="size-6 animate-spin text-[#22c55e]" />
              Sertifikat tayyorlanmoqda...
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#e2e8f0] px-5 py-3">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Yopish
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!pdfUrl}
            className="gap-2 rounded-xl bg-[#22c55e] px-5 font-semibold text-white hover:bg-[#16a34a] disabled:opacity-50"
          >
            <Download className="size-4" />
            PDF yuklab olish
          </Button>
        </div>
      </div>
    </div>
  )
}
