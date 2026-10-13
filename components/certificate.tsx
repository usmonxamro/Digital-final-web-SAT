'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildCertificatePdf } from '@/lib/certificate-pdf'
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

  useEffect(() => {
    let cancelled = false

    async function generate() {
      try {
        const doc = await buildCertificatePdf({ studentName, testTitle, composite, rw, math, review })
        if (cancelled) return
        const blob = doc.output('blob')
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
