'use client'

import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, FileDown, Loader2, Lock } from 'lucide-react'
import { ChoiceContent } from '@/components/choice-content'
import { QuestionImage } from '@/components/question-image'
import { QuestionStimulus } from '@/components/question-stimulus'
import { SITE_DOMAIN, SITE_URL, TG_PERSONAL } from '@/lib/contact'
import type { Question } from '@/lib/test-data'

/**
 * "Testni yuklab olish (PDF)": the finished mock's questions, ONE QUESTION PER PAGE, with the site's name on
 * every page (header, clickable footer) and a cover page — so a shared PDF advertises the site.
 *
 * The teacher decides per mock whether students get the button (test_configs.pdf_download).
 * Pages are drawn with the same components as the exam (KaTeX, tables, figures, the saved layout) and handed to the
 * browser's own "Print → Save as PDF": the result is a VECTOR pdf — real, selectable text, sharp formulas, working
 * links and a small file — instead of screenshots.
 */

export type PdfItem = {
  /** e.g. "Section 1, Module 1: Reading and Writing" — absent for single-module practice. */
  moduleLabel?: string
  sectionKind?: 'reading' | 'math'
  /** 0-based question index (within its module). */
  index: number
  question: Question
}

/**
 * Design size of one page. It is an A4 *proportion* but drawn on a bigger canvas (1000 × 1414 px) than a plain A4 at
 * 96 dpi (794 × 1123): text keeps its on-screen size, so MORE fits on a page (long questions no longer get squeezed)
 * and the page is scaled down to A4 when printed.
 */
const PAGE_W = 1000
const PAGE_H = 1414
const HEAD_H = 112
const FOOT_H = 68
const BODY_H = PAGE_H - HEAD_H - FOOT_H
const COL = 800
const MIN_SCALE = 0.62
const GREEN = '#0e7c75'
const GREEN_DEEP = '#0b4f4a'
/** A4 width in CSS px (210 mm) — what the page canvas is scaled to when printed. */
const A4_W = 793.7
/** Telegram channels advertised in the PDF. */
const PDF_CHANNELS = [
  { handle: '@satbyusmon', url: 'https://t.me/satbyusmon' },
  { handle: '@sat_surxon', url: 'https://t.me/sat_surxon' },
]

/**
 * Static TrueType Inter (public/pdf-fonts/inter): the site's own Inter is a *variable* font, which Chrome writes into
 * a PDF as "Type 3" glyph programs (fuzzy in many viewers). Static TrueType fonts are embedded as real, crisp,
 * hinted text — like a LaTeX-compiled PDF.
 */
const PDF_FONT = "'SATPrint', Arial, Helvetica, sans-serif"
const PDF_SERIF = "Georgia, 'Times New Roman', Times, serif"
const FONT_CSS = [400, 600, 700, 800]
  .map((w) =>
    [
      ['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
      ['latin-ext', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'],
    ]
      .map(
        ([sub, range]) =>
          `@font-face{font-family:'SATPrint';font-style:normal;font-weight:${w};font-display:block;src:url(/pdf-fonts/inter/inter-${sub}-${w}-normal.woff2) format('woff2');unicode-range:${range};}`,
      )
      .join('\n'),
  )
  .join('\n')

const COVER_W = 794
const COVER_H = 1123

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

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function Tick() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0e7c75" strokeWidth="3" style={{ flexShrink: 0 }}>
      <path d="m5 12 5 5 9-10" />
    </svg>
  )
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  )
}

/** The exam's header / footer (static copy of ExamHeader + ExamFooter) so the PDF looks like the real screen. */
function Frame({
  testTitle,
  items,
  moduleTotal,
  children,
  scale = 1,
  offset = 0,
  pageNo,
  pageTotal,
}: {
  testTitle: string
  /** One question, or two short ones sharing a page. */
  items: PdfItem[]
  moduleTotal: number
  children: React.ReactNode
  scale?: number
  offset?: number
  pageNo?: number
  pageTotal?: number
}) {
  const item = items[0]
  const math = item.sectionKind === 'math' || (!item.sectionKind && !item.question.passage)
  const label = item.moduleLabel ?? testTitle
  const nums = items.map((i) => i.index + 1)
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
        fontFamily: PDF_FONT,
      }}
    >
      {/* ------------------------------ header (like ExamHeader) ------------------------------ */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: HEAD_H, background: '#e7f3f1', borderBottom: '1px solid #d7e7e4' }}>
        <div style={{ position: 'relative', height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 44px' }}>
          <div style={{ lineHeight: 1.25, maxWidth: 340 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: GREEN_DEEP, letterSpacing: -0.2 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0e7c75', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              Directions <Chevron />
            </div>
          </div>
          <div style={{ position: 'absolute', left: '50%', top: 6, transform: 'translateX(-50%)', textAlign: 'center', lineHeight: 1.1 }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 0.4, color: '#111' }}>SAT AKADEMIYASI</div>
            <a
              href={SITE_URL}
              style={{ display: 'inline-block', marginTop: 5, border: '1px solid rgba(14,124,117,.45)', borderRadius: 999, padding: '1px 14px', fontSize: 12.5, fontWeight: 700, color: '#0e7c75', textDecoration: 'none' }}
            >
              {SITE_DOMAIN}
            </a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, color: '#375957', fontSize: 12.5, fontWeight: 600 }}>
            {math && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <Icon>
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <path d="M8 6h8M7 11h2M11 11h2M15 11h2M7 15h2M11 15h2M15 15h2M7 19h2M11 19h2" strokeLinecap="round" />
                  </Icon>
                  Calculator
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <Icon>
                    <path d="M4 19V6a2 2 0 0 1 2-2h8l6 6v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                    <path d="M14 4v6h6" />
                  </Icon>
                  Reference
                </div>
              </>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Icon>
                <circle cx="12" cy="5" r="1.4" fill="currentColor" />
                <circle cx="12" cy="12" r="1.4" fill="currentColor" />
                <circle cx="12" cy="19" r="1.4" fill="currentColor" />
              </Icon>
              More
            </div>
          </div>
        </div>
        <div style={{ height: 3, backgroundImage: 'repeating-linear-gradient(90deg,#111 0 20px,transparent 20px 26px)' }} />
        <div style={{ padding: '4px 50px 0' }}>
          <div
            style={{
              background: GREEN_DEEP,
              color: '#fff',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 0.6,
              padding: '5px 0',
              borderRadius: '0 0 12px 12px',
            }}
          >
            This is a practice test from{' '}
            <a href={SITE_URL} style={{ color: '#fff', textDecoration: 'underline' }}>
              {SITE_DOMAIN}
            </a>
          </div>
        </div>
      </div>

      {/* --------------------------------- question --------------------------------- */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: HEAD_H, height: BODY_H, overflow: 'hidden' }}>
        <div
          data-body
          style={{
            width: COL / scale,
            marginLeft: (PAGE_W - COL) / 2,
            paddingTop: 28 / scale,
            paddingBottom: 14 / scale,
            transform: `translateY(${-offset}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {children}
        </div>
      </div>

      {/* ------------------------------ footer (like ExamFooter) ------------------------------ */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: FOOT_H,
          padding: '0 50px',
          borderTop: '1px solid #d7e7e4',
          background: '#fff',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
          Usmon Xamroyev
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', marginTop: 2 }}>{pageNo ? `${pageNo} / ${pageTotal ?? ''}` : ''}</div>
        </div>
        <div style={{ background: '#111', color: '#fff', borderRadius: 999, padding: '7px 18px', fontSize: 14.5, fontWeight: 700 }}>
          {nums.length > 1 ? `Questions ${nums[0]}–${nums[nums.length - 1]}` : `Question ${nums[0]}`} of {moduleTotal} <Chevron />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 700 }}>
          {PDF_CHANNELS.map((c, i) => (
            <a
              key={c.handle}
              href={c.url}
              style={
                i === 0
                  ? { border: '1.5px solid #0e7c75', color: '#0e7c75', borderRadius: 999, padding: '6px 14px', textDecoration: 'none', background: '#fff' }
                  : { background: '#0e7c75', color: '#fff', borderRadius: 999, padding: '7px 15px', textDecoration: 'none' }
              }
            >
              {c.handle}
            </a>
          ))}
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
    ? 'text-[17px] font-semibold leading-[1.55] text-[#111]'
    : 'text-[17.5px] leading-[1.7] text-[#111]'

  return (
    <div>
      {/* q-head: number, Mark for Review, ABC */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 18,
          padding: '7px 12px',
          background: '#ececec',
          borderBottom: '2px dashed #111',
        }}
      >
        <span style={{ width: 30, height: 34, background: '#111', color: '#fff', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {item.index + 1}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 600, color: '#333' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          Mark for Review
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {q.difficulty && (
            <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.6, color: '#64748b', textTransform: 'uppercase' }}>{q.difficulty}</span>
          )}
          {!gridin && (
            <span style={{ border: '1.5px solid #0e7c75', borderRadius: 4, color: '#0e7c75', fontSize: 12, fontWeight: 800, padding: '2px 7px', textDecoration: 'line-through' }}>ABC</span>
          )}
        </span>
      </div>

      {reading && q.passage && (
        <div
          style={{
            fontFamily: PDF_SERIF,
            whiteSpace: 'pre-line',
            fontSize: 17,
            lineHeight: 1.6,
            padding: '4px 4px 4px 18px',
            marginBottom: 18,
            borderLeft: `4px solid ${GREEN}`,
          }}
        >
          <Underlined text={q.passage} underline={q.underline} />
        </div>
      )}
      {reading && q.image && <QuestionImage src={q.image} scale={q.layout?.img?.scale} plain />}

      <div style={{ marginBottom: 16 }}>
        <QuestionStimulus question={q} withFigure={!reading} textClassName={text} plain />
      </div>

      {gridin ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ width: 190, height: 58, border: '1.5px solid #777', borderRadius: 8, background: '#fff' }} />
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
                minHeight: 50,
                padding: '10px 15px',
                border: '1.5px solid #777',
                borderRadius: 8,
                background: '#fff',
                fontSize: 17,
                fontFamily: reading ? PDF_SERIF : undefined,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  border: '1.5px solid #777',
                  color: '#111',
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
        width: COVER_W,
        height: COVER_H,
        overflow: 'hidden',
        background: '#fff',
        fontFamily: PDF_FONT,
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
          {count} ta savol
        </div>
      </div>

      <div style={{ padding: '44px 56px 0', display: 'flex', gap: 40, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: GREEN_DEEP }}>Ko‘proq mock va tahlillar bizda</div>
          <ul style={{ marginTop: 14, paddingLeft: 0, listStyle: 'none', fontSize: 15, lineHeight: 1.9, color: '#334155', fontWeight: 600 }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tick /> Real Bluebook uslubidagi onlayn mocklar
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tick /> Har bir savolga batafsil yechim va video tahlil
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tick /> Natija, ball va sertifikat (PDF)
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tick /> O‘zbek tilidagi qulay interfeys
            </li>
          </ul>
          <div style={{ marginTop: 22, fontSize: 15, fontWeight: 800 }}>
            Sayt:{' '}
            <a href={SITE_URL} style={{ color: GREEN_DEEP, textDecoration: 'none' }}>
              {SITE_DOMAIN}
            </a>
          </div>
          <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800 }}>
            Telegram: <span style={{ color: GREEN_DEEP }}>{PDF_CHANNELS.map((c) => c.handle).join(' · ')}</span>
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
  onProgress?: (done: number, total: number, phase?: 'layout' | 'pages' | 'save') => void
  /** Put two short questions on one page when they fit (default true). */
  pack?: boolean
}

type PageSpec = { items: PdfItem[]; scale: number; offset: number }

/** One page's worth of questions (usually one; two short ones when they fit together). */
function PageBody({ items }: { items: PdfItem[] }) {
  return (
    <>
      {items.map((it, k) => (
        <div key={k} style={k > 0 ? { marginTop: 26, paddingTop: 26, borderTop: '2px dashed #b6c8c6' } : undefined}>
          <QuestionBody item={it} />
        </div>
      ))}
    </>
  )
}

const PRINT_ROOT_ID = 'sat-print-root'
const PRINT_STYLE_ID = 'sat-print-style'

const PRINT_CSS = `
${FONT_CSS}
.sat-pdf .font-serif { font-family: ${PDF_SERIF} !important; }
.sat-pdf .font-sans { font-family: ${PDF_FONT} !important; }
@media screen { #${PRINT_ROOT_ID} { position: fixed; left: -20000px; top: 0; width: ${PAGE_W}px; pointer-events: none; } #${PRINT_ROOT_ID} .sat-print-page { width: ${A4_W}px; height: 1122px; overflow: hidden; background: #fff; } }
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
  body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
  #${PRINT_ROOT_ID} { display: block !important; position: static !important; width: auto !important; }
  #${PRINT_ROOT_ID}, #${PRINT_ROOT_ID} * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sat-print-page { width: 210mm; height: 1122px; overflow: hidden; break-after: page; page-break-after: always; break-inside: avoid; }
  .sat-print-page:last-child { break-after: auto; page-break-after: auto; }
}
`

let activeCleanup: (() => void) | null = null

/**
 * Draws every page, then opens the browser's print dialog ("Save as PDF"). Resolves once the dialog was requested.
 * Pages that are too tall are shrunk to fit (down to MIN_SCALE) and, failing that, continue on the next page.
 */
export async function printTestPdf({ testTitle, items, onProgress, pack = true, mode = 'print' }: BuildOptions & { mode?: 'print' | 'file' }): Promise<void> {
  const QRMod = await import('qrcode')
  const QRCode = QRMod.default ?? QRMod
  const qr: string = await QRCode.toDataURL(SITE_URL, { margin: 1, width: 340, color: { dark: '#0f6b35', light: '#ffffff' } })

  activeCleanup?.()

  // fonts + print rules first, so the measuring pass already uses the real PDF font
  const style = document.createElement('style')
  style.id = PRINT_STYLE_ID
  style.textContent = PRINT_CSS
  document.head.appendChild(style)
  try {
    await Promise.all([400, 600, 700, 800].map((w) => document.fonts.load(`${w} 16px SATPrint`)))
  } catch {
    /* falls back to Arial */
  }

  // 1) measure each question in an off-screen page (same layout as the final one)
  const mHost = document.createElement('div')
  mHost.setAttribute('aria-hidden', 'true')
  mHost.className = 'sat-pdf'
  mHost.style.cssText = `position:fixed;left:-20000px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;pointer-events:none;`
  document.body.appendChild(mHost)
  const mRoot = createRoot(mHost)
  const specs: PageSpec[] = []
  const total = items.length + 1
  // "Question N of M" counts per module
  const moduleTotals = new Map<string, number>()
  for (const it of items) moduleTotals.set(it.moduleLabel ?? '', (moduleTotals.get(it.moduleLabel ?? '') ?? 0) + 1)
  const totalOf = (it: PdfItem) => moduleTotals.get(it.moduleLabel ?? '') ?? items.length

  const drawAt = async (group: PdfItem[], sc: number) => {
    flushSync(() =>
      mRoot.render(
        <Frame testTitle={testTitle} items={group} moduleTotal={totalOf(group[0])} scale={sc}>
          <PageBody items={group} />
        </Frame>,
      ),
    )
    const el = mHost.querySelector('[data-page]') as HTMLElement
    await settle(el)
    return (el.querySelector('[data-body]') as HTMLElement).getBoundingClientRect().height
  }

  type Unit = { item: PdfItem; h: number; scale: number; parts: number }
  const units: Unit[] = []
  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      let scale = 1
      let h = await drawAt([item], scale)
      const natural = h
      for (let tries = 0; tries < 3 && h > BODY_H + 1 && scale > MIN_SCALE; tries++) {
        scale = Math.max(MIN_SCALE, (scale * BODY_H) / h - 0.01)
        h = await drawAt([item], scale)
      }
      units.push({ item, h: natural, scale, parts: h > BODY_H + 1 ? Math.ceil(h / BODY_H) : 1 })
      onProgress?.(i + 1, total)
      await sleep(0)
    }

    // 2) two short questions of the same module share a page when they really fit together
    for (let i = 0; i < units.length; i++) {
      const u = units[i]
      const n = units[i + 1]
      const joinable =
        pack &&
        n &&
        u.scale === 1 &&
        u.parts === 1 &&
        n.scale === 1 &&
        n.parts === 1 &&
        u.item.moduleLabel === n.item.moduleLabel &&
        u.item.sectionKind === n.item.sectionKind &&
        u.h + n.h - 42 + 53 <= BODY_H
      if (joinable) {
        const both = [u.item, n.item]
        const h = await drawAt(both, 1)
        if (h <= BODY_H + 1) {
          specs.push({ items: both, scale: 1, offset: 0 })
          i++
          continue
        }
      }
      for (let k = 0; k < u.parts; k++) specs.push({ items: [u.item], scale: u.scale, offset: k * BODY_H })
    }
  } catch (e) {
    style.remove()
    throw e
  } finally {
    mRoot.unmount()
    mHost.remove()
  }

  // 3) the real print tree
  const host = document.createElement('div')
  host.id = PRINT_ROOT_ID
  host.className = 'sat-pdf'
  host.setAttribute('aria-hidden', 'true')
  document.body.appendChild(host)
  const root = createRoot(host)

  const date = new Date().toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric' })
  const pageTotal = specs.length
  flushSync(() =>
    root.render(
      <>
        <div className="sat-print-page">
          <div style={{ width: COVER_W, height: COVER_H, transform: `scale(${A4_W / COVER_W})`, transformOrigin: '0 0' }}>
            <CoverPage testTitle={testTitle} count={items.length} qr={qr} date={date} />
          </div>
        </div>
        {specs.map((sp, i) => (
          <div className="sat-print-page" key={i}>
            <div style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${A4_W / PAGE_W})`, transformOrigin: '0 0' }}>
              <Frame
                testTitle={testTitle}
                items={sp.items}
                moduleTotal={totalOf(sp.items[0])}
                scale={sp.scale}
                offset={sp.offset}
                pageNo={i + 1}
                pageTotal={pageTotal}
              >
                <PageBody items={sp.items} />
              </Frame>
            </div>
          </div>
        ))}
      </>,
    ),
  )
  await settle(host)
  onProgress?.(total, total)

  if (mode === 'file') {
    // phones: no print dialog — draw each page into an image and save one PDF file directly
    try {
      await savePagesAsPdf(host, fileNameOf(testTitle), onProgress)
    } finally {
      try {
        root.unmount()
      } catch {
        /* ignore */
      }
      host.remove()
      style.remove()
    }
    return
  }

  const prevTitle = document.title
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    window.removeEventListener('afterprint', cleanup)
    clearTimeout(timer)
    document.title = prevTitle
    try {
      root.unmount()
    } catch {
      /* ignore */
    }
    host.remove()
    style.remove()
    if (activeCleanup === cleanup) activeCleanup = null
  }
  activeCleanup = cleanup
  window.addEventListener('afterprint', cleanup)
  // phones may never fire afterprint — drop the hidden pages eventually
  const timer = setTimeout(cleanup, 15 * 60_000)

  // the print dialog proposes the document title as the file name
  document.title = fileNameOf(testTitle).replace(/\.pdf$/i, '')
  await sleep(60)
  window.print()
}

/**
 * Rasterises the hidden pages one by one (keeps phone memory low) and downloads a single PDF.
 * Each page is drawn alone, unscaled, at the top-left corner of the viewport (the progress overlay covers it): boxes that
 * are off-screen, scaled by CSS or measured while the page is scrolled come out shifted/cropped on phones.
 */
async function savePagesAsPdf(host: HTMLElement, fileName: string, onProgress?: BuildOptions['onProgress']) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const pages = Array.from(host.querySelectorAll<HTMLElement>('.sat-print-page'))
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const scrollY = window.scrollY
  window.scrollTo(0, 0)
  host.style.cssText = `position:fixed;left:0;top:0;width:${PAGE_W}px;z-index:-1;pointer-events:none;`
  const OUT_W = 1400 // px across the A4 width ≈ 170 dpi: sharp on a phone, ~250 KB a page
  try {
    for (let i = 0; i < pages.length; i++) {
      const w = i === 0 ? COVER_W : PAGE_W
      const h = i === 0 ? COVER_H : PAGE_H
      pages.forEach((pg, k) => {
        pg.style.cssText = k === i ? `display:block;width:${w}px;height:${h}px;overflow:hidden;background:#fff;` : 'display:none;'
        const inner = pg.firstElementChild as HTMLElement | null
        if (inner) inner.style.transform = 'none'
      })
      await sleep(30)
      const canvas = await html2canvas(pages[i], {
        scale: OUT_W / w,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H,
        scrollX: 0,
        scrollY: 0,
      })
      if (i > 0) pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.8), 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
      canvas.width = canvas.height = 0
      onProgress?.(i + 1, pages.length, 'pages')
      await sleep(0)
    }
    onProgress?.(pages.length, pages.length, 'save')
    const blob = pdf.output('blob')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } finally {
    window.scrollTo(0, scrollY)
  }
}

/** Phones and tablets get a straight file download; computers keep the sharper vector print path. */
function prefersFileDownload() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820
}

function fileNameOf(title: string) {
  const base = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'SAT test'
  return `${base} - SAT AKADEMIYASI.pdf`
}

const OVERLAY_CSS = `
@keyframes pdfIn { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
@keyframes pdfFloat { 0%,100% { transform: translateY(0) rotate(var(--r)) } 50% { transform: translateY(-7px) rotate(var(--r)) } }
@keyframes pdfScan { 0% { top: 8% } 100% { top: 86% } }
@keyframes pdfPulse { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes pdfPop { 0% { transform: scale(.4); opacity: 0 } 70% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
@keyframes pdfDots { 0% { content: '' } 25% { content: '.' } 50% { content: '..' } 75% { content: '...' } }
.pdf-ov { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; padding: 20px; background: radial-gradient(circle at 50% 30%, rgba(14,124,117,.38), rgba(5,12,12,.86)); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.pdf-card { width: min(360px, 100%); padding: 26px 24px 22px; border-radius: 28px; text-align: center; color: #e8fffd; background: linear-gradient(160deg, rgba(15,40,39,.96), rgba(7,20,20,.96)); border: 1px solid rgba(94,234,212,.22); box-shadow: 0 30px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.07); animation: pdfIn .45s cubic-bezier(.2,.9,.3,1.2) both; }
.pdf-stage { position: relative; width: 168px; height: 168px; margin: 0 auto 14px; }
.pdf-ring { position: absolute; inset: 0; transform: rotate(-90deg); }
.pdf-ring circle { fill: none; stroke-width: 7; stroke-linecap: round; }
.pdf-ring .bg { stroke: rgba(255,255,255,.08); }
.pdf-ring .fg { stroke: url(#pdfGrad); transition: stroke-dashoffset .5s cubic-bezier(.3,.8,.3,1); filter: drop-shadow(0 0 8px rgba(45,212,191,.7)); }
.pdf-sheets { position: absolute; inset: 30px; }
.pdf-sheet { position: absolute; left: 50%; top: 50%; width: 62px; height: 80px; margin: -40px 0 0 -31px; border-radius: 9px; background: #f4fffe; box-shadow: 0 6px 18px rgba(0,0,0,.35); overflow: hidden; animation: pdfFloat 2.6s ease-in-out infinite; }
.pdf-sheet:nth-child(1) { --r: -13deg; background: #bdeee8; animation-delay: -.8s; }
.pdf-sheet:nth-child(2) { --r: 9deg; background: #d9f7f3; animation-delay: -1.5s; }
.pdf-sheet:nth-child(3) { --r: 0deg; }
.pdf-sheet i { position: absolute; left: 9px; right: 9px; height: 4px; border-radius: 3px; background: #0e7c75; opacity: .55; }
.pdf-sheet i:nth-child(1) { top: 14px; right: 24px; opacity: .9 }
.pdf-sheet i:nth-child(2) { top: 26px } .pdf-sheet i:nth-child(3) { top: 36px; right: 16px } .pdf-sheet i:nth-child(4) { top: 46px } .pdf-sheet i:nth-child(5) { top: 56px; right: 28px }
.pdf-sheet b { position: absolute; left: 0; right: 0; height: 18px; top: 8%; background: linear-gradient(transparent, rgba(45,212,191,.55), transparent); animation: pdfScan 1.4s ease-in-out infinite alternate; }
.pdf-pct { position: absolute; left: 0; right: 0; bottom: -2px; text-align: center; font-size: 13px; font-weight: 800; letter-spacing: .3px; color: #5eead4; }
.pdf-big { font-size: 38px; font-weight: 800; line-height: 1; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
.pdf-title { margin: 0 0 4px; font-size: 17px; font-weight: 800; }
.pdf-sub { margin: 0 0 16px; min-height: 36px; font-size: 13px; line-height: 1.45; color: #9bd1cb; }
.pdf-sub::after { content: ''; animation: pdfDots 1.4s steps(1) infinite; }
.pdf-ok .pdf-sub::after { content: none; animation: none; }
.pdf-steps { display: flex; justify-content: center; gap: 6px; margin-bottom: 14px; }
.pdf-steps span { flex: 1; padding: 6px 4px; border-radius: 10px; font-size: 10.5px; font-weight: 700; color: #6aa8a2; background: rgba(255,255,255,.05); border: 1px solid transparent; }
.pdf-steps span.on { color: #021412; background: #5eead4; animation: pdfPulse 1.2s ease-in-out infinite; }
.pdf-steps span.dn { color: #5eead4; border-color: rgba(94,234,212,.35); }
.pdf-warn { margin: 0; font-size: 11.5px; color: #7fb3ad; }
.pdf-check { display: grid; place-items: center; width: 92px; height: 92px; margin: 38px auto 28px; border-radius: 50%; background: linear-gradient(135deg, #34d399, #0e7c75); color: #fff; box-shadow: 0 0 0 10px rgba(52,211,153,.14), 0 0 40px rgba(52,211,153,.5); animation: pdfPop .55s cubic-bezier(.2,.9,.3,1.3) both; }
.pdf-close { margin-top: 14px; width: 100%; height: 44px; border: 0; border-radius: 14px; background: #5eead4; color: #021412; font: inherit; font-size: 14px; font-weight: 800; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .pdf-sheet, .pdf-sheet b, .pdf-steps span.on, .pdf-sub::after { animation: none !important } }
`

type Prog = { pct: number; phase: 'layout' | 'pages' | 'save'; done: number; total: number }

/** Full-screen "your PDF is being made" card: floating pages, a progress ring, three steps — and a success state. */
function PdfProgressOverlay({ prog, finished, fileMode, onClose }: { prog: Prog; finished: boolean; fileMode: boolean; onClose: () => void }) {
  const R = 74
  const C = 2 * Math.PI * R
  const pct = finished ? 100 : Math.min(99, Math.round(prog.pct))
  const sub =
    prog.phase === 'layout'
      ? 'Savollar sahifalarga joylanmoqda'
      : prog.phase === 'pages'
        ? `Formulalar va rasmlar chizilmoqda — ${prog.done}/${prog.total}-sahifa`
        : 'PDF fayl yig‘ilmoqda'
  const stepState = (n: 1 | 2 | 3) => {
    const cur = prog.phase === 'layout' ? 1 : prog.phase === 'pages' ? 2 : 3
    return finished || n < cur ? 'dn' : n === cur ? 'on' : ''
  }
  return createPortal(
    <div className="pdf-ov" role="dialog" aria-modal="true" aria-live="polite">
      <style>{OVERLAY_CSS}</style>
      <div className={`pdf-card ${finished ? 'pdf-ok' : ''}`}>
        {finished ? (
          <>
            <div className="pdf-check">
              <Check size={46} strokeWidth={3.2} />
            </div>
            <h3 className="pdf-title">PDF tayyor!</h3>
            <p className="pdf-sub">{fileMode ? 'Fayl telefoningizning «Yuklamalar» (Downloads) papkasiga saqlandi.' : 'Chop etish oynasida «Save as PDF» ni tanlang.'}</p>
            <button type="button" className="pdf-close" onClick={onClose}>
              Yopish
            </button>
          </>
        ) : (
          <>
            <div className="pdf-stage">
              <svg className="pdf-ring" viewBox="0 0 168 168" aria-hidden>
                <defs>
                  <linearGradient id="pdfGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#34d399" />
                    <stop offset="1" stopColor="#5eead4" />
                  </linearGradient>
                </defs>
                <circle className="bg" cx="84" cy="84" r={R} />
                <circle className="fg" cx="84" cy="84" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
              </svg>
              <div className="pdf-sheets" aria-hidden>
                {[0, 1, 2].map((k) => (
                  <div className="pdf-sheet" key={k}>
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    {k === 2 && <b />}
                  </div>
                ))}
              </div>
            </div>
            <div className="pdf-big">{pct}%</div>
            <h3 className="pdf-title" style={{ marginTop: 8 }}>
              PDF tayyorlanmoqda
            </h3>
            <p className="pdf-sub">{sub}</p>
            <div className="pdf-steps">
              <span className={stepState(1)}>1 · Sahifalar</span>
              <span className={stepState(2)}>2 · Chizish</span>
              <span className={stepState(3)}>3 · Saqlash</span>
            </div>
            <p className="pdf-warn">Iltimos, sahifani yopmang va ekranni o‘chirmang.</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Shown instead of the download button when the test was finished far too fast to have been worked through. */
export function PdfLockedNote({ className }: { className?: string }) {
  return (
    <div className={`mx-auto max-w-[400px] rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-center ${className ?? ''}`}>
      <p className="flex items-center justify-center gap-2 text-[13px] font-extrabold text-amber-900">
        <Lock className="size-4" /> PDF yuklab olish hozircha yopiq
      </p>
      <p className="mt-1 text-[12px] font-medium leading-relaxed text-amber-900/80">
        Test juda tez yakunlandi, savollar to‘liq ishlanmagan ko‘rinadi. Testni diqqat bilan, vaqt sarflab ishlab chiqsangiz, PDF yuklab olish ochiladi.
      </p>
    </div>
  )
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
  const [prog, setProg] = useState<Prog>({ pct: 0, phase: 'layout', done: 0, total: (items?.length ?? 0) + 1 })
  const [errText, setErrText] = useState('PDF yaratib bo‘lmadi. Qayta urinib ko‘ring.')
  const [overlay, setOverlay] = useState<'off' | 'busy' | 'done'>('off')
  const running = useRef(false)
  const [fileMode, setFileMode] = useState(false)
  useEffect(() => setFileMode(prefersFileDownload()), [])
  useEffect(() => {
    if (overlay !== 'done') return
    const t = setTimeout(() => setOverlay('off'), 6000)
    return () => clearTimeout(t)
  }, [overlay])

  async function run(forceMode?: 'print' | 'file') {
    if (running.current) return
    running.current = true
    const mode = forceMode ?? (prefersFileDownload() ? 'file' : 'print')
    setState(loadItems ? 'loading' : 'busy')
    if (!compact) setOverlay('busy')
    try {
      const list = items ?? (await loadItems!())
      if (list.length === 0) {
        setErrText('Bu mockda savol topilmadi.')
        setState('error')
        setOverlay('off')
        return
      }
      setProg({ pct: 0, phase: 'layout', done: 0, total: list.length + 1 })
      setState('busy')
      await printTestPdf({
        testTitle,
        items: list,
        mode,
        onProgress: (done, total, phase = 'layout') =>
          setProg({ phase, done, total, pct: phase === 'layout' ? (done / Math.max(1, total)) * 40 : phase === 'pages' ? 40 + (done / Math.max(1, total)) * 57 : 99 }),
      })
      setState('done')
      setOverlay(!compact && mode === 'file' ? 'done' : 'off')
    } catch (e) {
      console.error('Test PDF failed', e)
      setErrText('PDF yaratib bo‘lmadi. Qayta urinib ko‘ring.')
      setState('error')
      setOverlay('off')
    } finally {
      running.current = false
    }
  }

  const pct = Math.round(prog.pct)
  const working = state === 'busy' || state === 'loading'

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => run()}
        disabled={working}
        title={state === 'error' ? errText : 'Mockning savollarini PDF qilib yuklab olish (chop etish oynasida «Save as PDF» ni tanlang, «Microsoft Print to PDF» ni emas)'}
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
      {overlay !== 'off' && <PdfProgressOverlay prog={prog} finished={overlay === 'done'} fileMode={fileMode} onClose={() => setOverlay('off')} />}
      <button
        type="button"
        onClick={() => run()}
        disabled={working}
        className="relative inline-flex min-w-[260px] items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#7c3aed,#6366f1)] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_8px_22px_rgba(99,102,241,.38)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:hover:translate-y-0"
      >
        <span className="relative inline-flex items-center gap-2.5">
          {working ? <Loader2 className="size-5 animate-spin" /> : <FileDown className="size-5" />}
          {state === 'loading' ? 'Savollar yuklanmoqda…' : state === 'busy' ? `PDF tayyorlanmoqda… ${pct}%` : state === 'done' ? 'Yana yuklab olish (PDF)' : label ?? 'Testni yuklab olish (PDF)'}
        </span>
      </button>
      {fileMode && (
        <p className="mx-auto mt-2 max-w-[340px] text-[11.5px] font-medium leading-relaxed text-[#64748b]">
          Tugmani bossangiz PDF o‘zi yuklanadi. Matnini belgilab ko‘chirish kerak bo‘lsa —{' '}
          <button type="button" onClick={() => run('print')} disabled={working} className="font-bold text-violet-700 underline underline-offset-2">
            matnli PDF
          </button>{' '}
          (chop etish oynasi orqali).
        </p>
      )}
      {!fileMode && (state === 'idle' || state === 'done' || state === 'busy') && (
        <p className="mx-auto mt-2 max-w-[340px] text-[11.5px] font-medium leading-relaxed text-[#64748b]">
          Chop etish oynasida <b className="text-[#0f172a]">Printer / Destination</b> qismidan <b className="text-green-700">«Save as PDF»</b> (PDF sifatida saqlash) ni tanlang.{' '}
          <b className="text-red-600">«Microsoft Print to PDF» ni tanlamang</b> — u sahifalarni xira rasmga aylantirib qo‘yadi.
        </p>
      )}
      {state === 'error' && (
        <p className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-red-600">
          <AlertTriangle className="size-3.5" /> {errText}
        </p>
      )}
    </div>
  )
}
