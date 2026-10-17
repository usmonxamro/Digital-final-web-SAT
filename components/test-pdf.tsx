'use client'

import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { AlertTriangle, FileDown, Loader2 } from 'lucide-react'
import { ChoiceContent } from '@/components/choice-content'
import { QuestionImage } from '@/components/question-image'
import { QuestionStimulus } from '@/components/question-stimulus'
import { SITE_DOMAIN, SITE_URL, TG_CHANNELS, TG_PERSONAL } from '@/lib/contact'
import type { Question } from '@/lib/test-data'

/**
 * "Testni yuklab olish (PDF)": the finished mock's questions, ONE QUESTION PER PAGE, with the site's name on
 * every page (header, soft watermark, clickable footer) and a cover page — so a shared PDF advertises the site.
 *
 * The teacher decides per mock whether students get the button (test_configs.pdf_download).
 * Pages are drawn with the same components as the exam (KaTeX, tables, figures, the saved layout), captured
 * with html2canvas and assembled with jsPDF. The footer is real vector text (selectable, links work).
 */

export type PdfItem = {
  /** e.g. "Section 1, Module 1: Reading and Writing" — absent for single-module practice. */
  moduleLabel?: string
  sectionKind?: 'reading' | 'math'
  /** 0-based question index (within its module). */
  index: number
  question: Question
}

/** CSS px of an A4 page at 96 dpi. */
const PAGE_W = 794
const PAGE_H = 1123
const HEAD_H = 62
const FOOT_H = 64
const BODY_H = PAGE_H - HEAD_H - FOOT_H
const SIDE = 46
const MIN_SCALE = 0.62
const GREEN = '#16a34a'
const GREEN_DEEP = '#0f6b35'

/* ----------------------------- page building blocks ----------------------------- */

function Brand({ light }: { light?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'linear-gradient(155deg,#34d399,#059669)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M12 3c5 0 8 3 8 8 0 6-5 10-8 10S4 17 4 11c0-5 3-8 8-8Z" />
          <path d="M12 3v18" />
        </svg>
      </div>
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 0.2, color: light ? '#fff' : '#0f172a' }}>SAT AKADEMIYASI</div>
        <div style={{ fontWeight: 600, fontSize: 10.5, color: light ? 'rgba(255,255,255,.85)' : '#64748b' }}>{SITE_DOMAIN}</div>
      </div>
    </div>
  )
}

function Frame({ testTitle, children, scale = 1, offset = 0 }: { testTitle: string; children: React.ReactNode; scale?: number; offset?: number }) {
  return (
    <div
      data-page
      style={{
        position: 'relative',
        width: PAGE_W,
        height: PAGE_H,
        background: '#fff',
        overflow: 'hidden',
        color: '#111',
        fontFamily: 'var(--font-jakarta), "Plus Jakarta Sans", Arial, Helvetica, sans-serif',
      }}
    >
      {/* soft diagonal watermark */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: -60,
          right: -60,
          top: PAGE_H / 2 - 60,
          textAlign: 'center',
          transform: 'rotate(-32deg)',
          fontWeight: 900,
          fontSize: 92,
          letterSpacing: 6,
          color: 'rgba(22,163,74,0.06)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        SAT AKADEMIYASI
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: HEAD_H,
          padding: `0 ${SIDE}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `3px solid ${GREEN}`,
          background: 'linear-gradient(90deg, rgba(240,253,244,.95), rgba(255,255,255,.9))',
        }}
      >
        <Brand />
        <div style={{ maxWidth: 400, textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: '#334155', lineHeight: 1.25 }}>{testTitle}</div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: HEAD_H, height: BODY_H, overflow: 'hidden' }}>
        <div
          data-body
          style={{
            width: (PAGE_W - SIDE * 2) / scale,
            marginLeft: SIDE,
            paddingTop: 22 / scale,
            paddingBottom: 12 / scale,
            transform: `translateY(${-offset}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function Underlined({ text, underline }: { text: string; underline?: string }) {
  const at = underline ? text.indexOf(underline) : -1
  if (!underline || at === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{underline}</span>
      {text.slice(at + underline.length)}
    </>
  )
}

function QuestionBody({ item }: { item: PdfItem }) {
  const q = item.question
  const reading = item.sectionKind === 'reading' || (!item.sectionKind && !!q.passage)
  const gridin = q.type === 'gridin'
  const text = reading
    ? 'text-[16px] font-semibold leading-[1.5] text-[#111]'
    : 'text-[16px] leading-[1.65] text-[#111]'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span
          style={{
            width: 38,
            height: 38,
            background: '#111',
            color: '#fff',
            borderRadius: 6,
            fontWeight: 800,
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {item.index + 1}
        </span>
        <div style={{ lineHeight: 1.25 }}>
          {item.moduleLabel && <div style={{ fontSize: 12, fontWeight: 800, color: GREEN_DEEP, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.moduleLabel}</div>}
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
            {q.domain ?? (reading ? 'Reading and Writing' : 'Math')}
          </div>
        </div>
      </div>

      {reading && q.passage && (
        <div
          className="font-serif"
          style={{
            whiteSpace: 'pre-line',
            fontSize: 15.5,
            lineHeight: 1.5,
            padding: '14px 18px',
            marginBottom: 16,
            border: '1px solid #d9e2dc',
            borderLeft: `4px solid ${GREEN}`,
            borderRadius: 8,
            background: 'rgba(240,253,244,.55)',
          }}
        >
          <Underlined text={q.passage} underline={q.underline} />
        </div>
      )}
      {reading && q.image && <QuestionImage src={q.image} scale={q.layout?.img?.scale} plain />}

      <div style={{ marginBottom: 14 }}>
        <QuestionStimulus question={q} withFigure={!reading} textClassName={text} plain />
      </div>

      {gridin ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Student-produced response — javobingizni shu yerga yozing</div>
          <div style={{ width: 150, height: 56, border: '1.5px solid #3a3a3a', borderRadius: 8, background: '#fff' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(q.choices ?? []).map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '10px 14px',
                border: '1.5px solid #bbe5c8',
                borderRadius: 10,
                background: 'rgba(240,253,244,.8)',
                fontSize: 16,
                fontFamily: reading ? 'Georgia, "Times New Roman", serif' : undefined,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  border: `1.5px solid ${GREEN_DEEP}`,
                  color: GREEN_DEEP,
                  background: '#fff',
                  fontWeight: 800,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                }}
              >
                {c.id}
              </span>
              <ChoiceContent choice={c} scale={q.layout?.choiceImg?.[c.id]?.scale} plain />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CoverPage({ testTitle, count, qr, date }: { testTitle: string; count: number; qr: string; date: string }) {
  return (
    <div
      data-page
      style={{
        position: 'relative',
        width: PAGE_W,
        height: PAGE_H,
        overflow: 'hidden',
        background: '#fff',
        fontFamily: 'var(--font-jakarta), "Plus Jakarta Sans", Arial, Helvetica, sans-serif',
        color: '#0f172a',
      }}
    >
      <div style={{ height: 430, background: 'linear-gradient(150deg,#059669 0%,#16a34a 55%,#34d399 100%)', padding: '48px 56px', color: '#fff', position: 'relative' }}>
        <div aria-hidden style={{ position: 'absolute', right: -90, top: -90, width: 340, height: 340, borderRadius: 170, background: 'rgba(255,255,255,.10)' }} />
        <div aria-hidden style={{ position: 'absolute', right: 80, bottom: -120, width: 260, height: 260, borderRadius: 130, background: 'rgba(255,255,255,.08)' }} />
        <Brand light />
        <div style={{ marginTop: 92, fontSize: 14, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.9 }}>Digital SAT · Mashq testi</div>
        <div style={{ marginTop: 12, fontSize: testTitle.length > 36 ? 38 : 46, fontWeight: 900, lineHeight: 1.1, maxWidth: 640 }}>{testTitle}</div>
        <div style={{ marginTop: 22, fontSize: 16, fontWeight: 600, opacity: 0.95 }}>
          {count} ta savol · har sahifada bitta savol
        </div>
      </div>

      <div style={{ padding: '44px 56px 0', display: 'flex', gap: 40, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: GREEN_DEEP }}>Ko‘proq mock va tahlillar bizda</div>
          <ul style={{ marginTop: 14, paddingLeft: 0, listStyle: 'none', fontSize: 15, lineHeight: 1.9, color: '#334155', fontWeight: 600 }}>
            <li>✔ Real Bluebook uslubidagi onlayn mocklar</li>
            <li>✔ Har bir savolga batafsil yechim va video tahlil</li>
            <li>✔ Natija, ball va sertifikat (PDF)</li>
            <li>✔ O‘zbek tilidagi qulay interfeys</li>
          </ul>
          <div style={{ marginTop: 22, fontSize: 15, fontWeight: 800 }}>
            Sayt: <span style={{ color: GREEN_DEEP }}>{SITE_DOMAIN}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800 }}>
            Telegram: <span style={{ color: GREEN_DEEP }}>{TG_CHANNELS.map((c) => c.handle).join(' · ')}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800 }}>
            Murojaat: <span style={{ color: GREEN_DEEP }}>{TG_PERSONAL}</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', width: 190 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR" width={170} height={170} style={{ display: 'block', margin: '0 auto', borderRadius: 8, border: '1px solid #e2e8f0', padding: 6 }} />
          <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: '#475569' }}>Saytni ochish uchun skanerlang</div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 56, right: 56, bottom: 120, fontSize: 12, color: '#64748b', lineHeight: 1.6, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
        Ushbu fayl {SITE_DOMAIN} saytidan {date} sanasida yuklab olindi. Faylni do‘stlaringiz bilan baham ko‘rishingiz mumkin — manbani ko‘rsatsangiz xursand bo‘lamiz.
      </div>
    </div>
  )
}

/* ------------------------------- the generator ------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Wait until the page's pictures and fonts are in and React has re-rendered with their sizes. */
async function settle(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth
        ? null
        : new Promise<void>((res) => {
            img.addEventListener('load', () => res(), { once: true })
            img.addEventListener('error', () => res(), { once: true })
            setTimeout(res, 12000)
          }),
    ),
  )
  try {
    await document.fonts.ready
  } catch {
    /* ignore */
  }
  await sleep(70)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
}

export type BuildOptions = {
  testTitle: string
  items: PdfItem[]
  onProgress?: (done: number, total: number) => void
}

/** Builds the PDF. Heavy libraries are loaded here, not on page load. */
export async function buildTestPdf({ testTitle, items, onProgress }: BuildOptions): Promise<Blob> {
  const [{ jsPDF }, h2cMod, QRMod] = await Promise.all([import('jspdf'), import('html2canvas-pro'), import('qrcode')])
  const html2canvas = h2cMod.default
  const QRCode = QRMod.default ?? QRMod
  const qr: string = await QRCode.toDataURL(SITE_URL, { margin: 1, width: 340, color: { dark: '#0f6b35', light: '#ffffff' } })

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const SCALE = 1.6
  let pdfPages = 0

  const draw = async (node: React.ReactNode): Promise<HTMLElement> => {
    flushSync(() => root.render(node))
    const el = host.querySelector('[data-page]') as HTMLElement
    await settle(el)
    return el
  }
  const capture = async (el: HTMLElement) => {
    const canvas = await html2canvas(el, {
      scale: SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: PAGE_W,
      height: PAGE_H,
      windowWidth: PAGE_W,
      scrollX: 0,
      scrollY: 0,
    })
    const jpeg = canvas.toDataURL('image/jpeg', 0.8)
    canvas.width = canvas.height = 0
    if (pdfPages > 0) doc.addPage()
    pdfPages++
    doc.addImage(jpeg, 'JPEG', 0, 0, PW, PH, undefined, 'FAST')
  }

  const total = items.length + 1
  try {
    // Cover
    const date = new Date().toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric' })
    await capture(await draw(<CoverPage testTitle={testTitle} count={items.length} qr={qr} date={date} />))
    onProgress?.(1, total)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      // 1) natural height
      let scale = 1
      let el = await draw(
        <Frame testTitle={testTitle} scale={scale}>
          <QuestionBody item={item} />
        </Frame>,
      )
      const measure = () => (el.querySelector('[data-body]') as HTMLElement).getBoundingClientRect().height
      let h = measure()
      // 2) too tall → shrink the whole page content to fit (down to MIN_SCALE); wider text reflows shorter
      for (let tries = 0; tries < 3 && h > BODY_H + 1 && scale > MIN_SCALE; tries++) {
        scale = Math.max(MIN_SCALE, (scale * BODY_H) / h - 0.01)
        el = await draw(
          <Frame testTitle={testTitle} scale={scale}>
            <QuestionBody item={item} />
          </Frame>,
        )
        h = measure()
      }
      // 3) still too tall → continue on following pages
      const parts = h > BODY_H + 1 ? Math.ceil(h / BODY_H) : 1
      for (let k = 0; k < parts; k++) {
        if (k > 0) {
          el = await draw(
            <Frame testTitle={testTitle} scale={scale} offset={k * BODY_H}>
              <QuestionBody item={item} />
            </Frame>,
          )
        }
        await capture(el)
      }
      onProgress?.(i + 2, total)
      // let the browser breathe (phones)
      await sleep(0)
    }

    // Vector footer on every page: a rule, the site (clickable), channels and "n / N".
    const n = doc.getNumberOfPages()
    const k = PW / PAGE_W
    const fy = PH - FOOT_H * k
    for (let p = 1; p <= n; p++) {
      doc.setPage(p)
      doc.setFillColor(255, 255, 255)
      doc.rect(0, fy, PW, FOOT_H * k, 'F')
      doc.setDrawColor(22, 163, 74)
      doc.setLineWidth(1.6)
      doc.line(SIDE * k, fy + 4, PW - SIDE * k, fy + 4)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10.5)
      doc.setTextColor(15, 107, 53)
      doc.textWithLink(SITE_DOMAIN, SIDE * k, fy + 26, { url: SITE_URL })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      doc.text(`Telegram: ${TG_CHANNELS.map((c) => c.handle).join('  |  ')}`, PW / 2, fy + 26, { align: 'center' })
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(`${p} / ${n}`, PW - SIDE * k, fy + 26, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(120, 130, 145)
      doc.text('SAT AKADEMIYASI — Usmon Xamroyev bilan', PW / 2, fy + 40, { align: 'center' })
    }
    doc.setProperties({ title: `${testTitle} — SAT AKADEMIYASI`, subject: 'Digital SAT', author: 'SAT AKADEMIYASI', creator: SITE_DOMAIN })
    return doc.output('blob')
  } finally {
    root.unmount()
    host.remove()
  }
}

function fileNameOf(title: string) {
  const base = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'SAT test'
  return `${base} - SAT AKADEMIYASI.pdf`
}

/** Saves a blob as a file (works on phones too). */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 120_000)
}

/**
 * The button shown on a finished mock's result screen — only when the teacher allowed it for this mock.
 */
export function DownloadTestPdfButton({
  testTitle,
  items,
  loadItems,
  label,
  className,
  compact,
}: {
  testTitle: string
  /** Questions already in hand (student result screen)… */
  items?: PdfItem[]
  /** …or fetched when the button is pressed (admin list). */
  loadItems?: () => Promise<PdfItem[]>
  label?: string
  className?: string
  /** Small pill instead of the big button (admin rows). */
  compact?: boolean
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'busy' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState({ done: 0, total: (items?.length ?? 0) + 1 })
  const [errText, setErrText] = useState('PDF yaratib bo‘lmadi. Qayta urinib ko‘ring.')
  const running = useRef(false)

  async function run() {
    if (running.current) return
    running.current = true
    setState(loadItems ? 'loading' : 'busy')
    try {
      const list = items ?? (await loadItems!())
      if (list.length === 0) {
        setErrText('Bu mockda savol topilmadi.')
        setState('error')
        return
      }
      setProgress({ done: 0, total: list.length + 1 })
      setState('busy')
      const blob = await buildTestPdf({ testTitle, items: list, onProgress: (done, total) => setProgress({ done, total }) })
      saveBlob(blob, fileNameOf(testTitle))
      setState('done')
    } catch (e) {
      console.error('Test PDF failed', e)
      setErrText('PDF yaratib bo‘lmadi. Qayta urinib ko‘ring.')
      setState('error')
    } finally {
      running.current = false
    }
  }

  const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100)
  const working = state === 'busy' || state === 'loading'

  if (compact) {
    return (
      <button
        type="button"
        onClick={run}
        disabled={working}
        title={state === 'error' ? errText : 'Mockning savollarini PDF qilib yuklab olish (har sahifada bitta savol)'}
        className={`flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition-colors disabled:cursor-wait ${
          state === 'error' ? 'border-red-300 bg-red-50 text-red-700' : 'border-violet-300 bg-white text-violet-700 hover:bg-violet-50'
        } ${className ?? ''}`}
      >
        {working ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} />}
        {state === 'loading' ? 'Yuklanmoqda…' : state === 'busy' ? `${pct}%` : state === 'error' ? 'Xato — qayta' : state === 'done' ? 'Yana yuklab olish' : label ?? 'PDF yuklab olish'}
      </button>
    )
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={run}
        disabled={working}
        className="relative inline-flex min-w-[260px] items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#6366f1)] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_8px_22px_rgba(99,102,241,.38)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:hover:translate-y-0"
      >
        {state === 'busy' && <span aria-hidden className="absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-300" style={{ width: `${pct}%` }} />}
        <span className="relative inline-flex items-center gap-2.5">
          {working ? <Loader2 className="size-5 animate-spin" /> : <FileDown className="size-5" />}
          {state === 'loading' ? 'Savollar yuklanmoqda…' : state === 'busy' ? `PDF tayyorlanmoqda… ${pct}%` : state === 'done' ? 'Yana yuklab olish (PDF)' : label ?? 'Testni yuklab olish (PDF)'}
        </span>
      </button>
      {state === 'busy' && <p className="mt-2 text-xs font-semibold text-[#64748b]">Iltimos, sahifani yopmang — savollar sahifa-sahifa tayyorlanmoqda.</p>}
      {state === 'done' && <p className="mt-2 text-xs font-semibold text-green-700">Tayyor! Fayl yuklab olindi.</p>}
      {state === 'error' && (
        <p className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-red-600">
          <AlertTriangle className="size-3.5" /> {errText}
        </p>
      )}
    </div>
  )
}
