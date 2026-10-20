'use client'

import { useEffect, useState } from 'react'
import { printTestPdf } from '@/components/test-pdf'
import { assemblePdfItems } from '@/lib/mock-pdf-items'
import type { Question } from '@/lib/test-data'

/**
 * Used ONLY by the teacher's PDF job (build_mock_pdfs.py): /pdf-job?label=…&key=…
 * Draws the mock's pages exactly like the student download, then raises window.__pdfReady so the job can print the page
 * to a real vector PDF. Students never see this page; it needs the PDF_JOB_KEY secret.
 */
export default function PdfJobPage() {
  const [msg, setMsg] = useState('PDF tayyorlanmoqda…')

  useEffect(() => {
    const w = window as unknown as { __pdfReady?: boolean; __pdfError?: string }
    const params = new URLSearchParams(window.location.search)
    const label = params.get('label') ?? ''
    const key = params.get('key') ?? ''
    ;(async () => {
      try {
        const res = await fetch(`/api/pdf-job?label=${encodeURIComponent(label)}&key=${encodeURIComponent(key)}`)
        if (!res.ok) throw new Error(`API ${res.status}`)
        const data = (await res.json()) as { config: Parameters<typeof assemblePdfItems>[0]; reading: Question[]; math: Question[] }
        const items = await assemblePdfItems(data.config, async (kind) => (kind === 'math' ? data.math : data.reading))
        if (items.length === 0) throw new Error('Mockda savol topilmadi')
        await printTestPdf({ testTitle: label, items, mode: 'job' })
        setMsg(`Tayyor: ${items.length} ta savol`)
        w.__pdfReady = true
      } catch (e) {
        const text = e instanceof Error ? e.message : String(e)
        setMsg(`Xato: ${text}`)
        w.__pdfError = text
      }
    })()
  }, [])

  return <main style={{ padding: 24, fontFamily: 'sans-serif' }}>{msg}</main>
}
