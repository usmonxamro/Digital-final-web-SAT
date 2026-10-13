import type { SectionResult } from './scoring'
import type { ReviewItem } from '@/components/score-report'

export type CertificateData = {
  studentName: string
  testTitle: string
  composite: number
  rw: SectionResult
  math: SectionResult
  review: ReviewItem[]
}

const RW_DOMAINS: { name: string; blueprint: string }[] = [
  { name: 'Information and Ideas', blueprint: '26% of test section, 12 - 14 questions' },
  { name: 'Expression of Ideas', blueprint: '20% of test section, 8 - 12 questions' },
  { name: 'Craft and Structure', blueprint: '28% of test section, 13 - 15 questions' },
  { name: 'Standard English Conventions', blueprint: '26% of test section, 11 - 15 questions' },
]

const MATH_DOMAINS: { name: string; blueprint: string }[] = [
  { name: 'Algebra', blueprint: '35% of test section, 13 - 15 questions' },
  { name: 'Advanced Math', blueprint: '35% of test section, 13 - 15 questions' },
  { name: 'Problem-Solving and Data Analysis', blueprint: '15% of test section, 5 - 7 questions' },
  { name: 'Geometry and Trigonometry', blueprint: '15% of test section, 5 - 7 questions' },
]

const SEGMENTS = 6
const BLACK: [number, number, number] = [0, 0, 0]
// All body/label text in the real report is pure black — only weight and size vary.
const TEXT = BLACK
const BOX_LINE: [number, number, number] = [217, 217, 217] // #D9D9D9 — outer box + section dividers
const MINI_LINE: [number, number, number] = [136, 136, 136] // #888888 — small in-row dividers

// Baseline calibration: the source PDF (react-pdf/Roboto) reports each text run's
// bounding box as exactly [top, top+size] (nominal line height, not ink bounds).
// Roboto's ascent is ~0.93em, so baseline sits ~0.93*size below "top".
const BASELINE_K = 0.93
function baseline(top: number, size: number) {
  return top + size * BASELINE_K
}

function domainStats(review: ReviewItem[], domain: string) {
  let correct = 0
  let total = 0
  for (const item of review) {
    if (item.question.domain !== domain) continue
    total++
    if (item.correct) correct++
  }
  return { correct, total }
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** jsPDF has no built-in dashed/dotted line helper — draw one manually (fine dots, matching the source's [1, 1.2] dash pattern). */
function dottedLine(doc: InstanceType<typeof import('jspdf').jsPDF>, x1: number, y: number, x2: number) {
  const dashLen = 1
  const gapLen = 1.2
  let x = x1
  while (x < x2) {
    const segEnd = Math.min(x + dashLen, x2)
    doc.line(x, y, segEnd, y)
    x = segEnd + gapLen
  }
}

/** Builds the practice score report as a real, text-selectable PDF (no rasterization). */
export async function buildCertificatePdf(data: CertificateData) {
  const [{ jsPDF }, QRCodeMod] = await Promise.all([import('jspdf'), import('qrcode')])
  const QRCode = QRCodeMod.default ?? QRCodeMod

  // A4 — matches the real report exactly (595.28 x 841.89 pt), margin 40pt.
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 40
  const left = margin
  const right = pageW - margin // 555.28, matches measured 555.3

  function printLines(lines: string[], x: number, topY: number, size: number, lineGap: number, align: 'left' | 'right' | 'center' = 'left') {
    lines.forEach((line, i) => doc.text(line, x, baseline(topY, size) + i * lineGap, { align }))
  }

  doc.setTextColor(...TEXT)

  /* ------------------------------- Header ------------------------------- */
  // Our own brand mark (a boxed logo), sized/positioned to match the source's logo slot.
  const logoTop = 40
  const logoH = 28
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.9)
  doc.roundedRect(left, logoTop, 148, logoH, 6, 6, 'S')
  const iconCx = left + 17
  const iconCy = logoTop + logoH / 2
  doc.setFillColor(...BLACK)
  doc.circle(iconCx, iconCy, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('S', iconCx, iconCy + 3.1, { align: 'center' })
  doc.setTextColor(...TEXT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('SAT AKADEMIYASI', iconCx + 16, iconCy + 3.6)

  // Name + disclaimer (right-aligned). "Name:" is regular weight; the name itself is bold —
  // matching the source exactly (two separate font runs on one line).
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const nameWidthBold = doc.getTextWidth(data.studentName)
  const nameBaselineY = baseline(41.5, 9)
  doc.text(data.studentName, right, nameBaselineY, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.text('Name: ', right - nameWidthBold, nameBaselineY, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const disclaimer = doc.splitTextToSize(
    'This practice score report is provided by SAT AKADEMIYASI by Usmon Xamroyev for your personal use to help you prepare for test day. These scores are for personal practice only and cannot be sent to colleges or scholarship programs.',
    240,
  ) as string[]
  printLines(disclaimer, right, 67.9, 8, 9.4, 'right')

  /* -------------------------------- Title -------------------------------- */
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('Your Practice', left, baseline(95.8, 22))
  doc.text('Score Report', left, baseline(121.6, 22))

  /* ---------------------------- Main outer box ---------------------------- */
  const boxTop = 158.6
  const boxLeft = left
  const boxRight = right
  const ruleLeft = boxLeft + 1
  const ruleRight = boxRight - 1

  // "SAT Practice Test" + date
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(data.testTitle, boxLeft + 11, baseline(boxTop + 13.7, 16))
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(todayLabel(), ruleRight, baseline(boxTop + 15.4, 12), { align: 'right' })

  // Rule under the title row — edge to edge, matches box width exactly.
  const rule1Y = boxTop + 40.7
  doc.setDrawColor(...BOX_LINE)
  doc.setLineWidth(1.1)
  doc.line(ruleLeft, rule1Y, ruleRight, rule1Y)

  /* ------------------------------ Score row ------------------------------ */
  // Absolute column positions measured from the source document.
  const col1X = boxLeft + 9
  const div1X = boxLeft + 119.3
  const col2X = boxLeft + 135.3
  const div2X = boxLeft + 295.8
  const col3X = boxLeft + 311.8
  const rowTop = boxTop + 50.4

  // Column 1 — TOTAL SCORE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL SCORE', col1X, baseline(rowTop, 12))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(40)
  doc.text(String(data.composite), col1X, baseline(boxTop + 69.1, 40))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Score Range: 400-1600', col1X, baseline(boxTop + 108.8, 8))
  doc.setDrawColor(...BOX_LINE)
  doc.setLineWidth(1.1)
  dottedLine(doc, col1X, boxTop + 132.5, col1X + 85.3)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const rangeNote = doc.splitTextToSize(
    'Score Range: This range reflects the minimum and maximum total score you can get with this assessment.',
    100,
  ) as string[]
  printLines(rangeNote, col1X, boxTop + 159.9, 8, 9.4)

  // Column 2 — SECTION SCORES
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('SECTION SCORES', col2X, baseline(rowTop, 10))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Reading and Writing', col2X, baseline(boxTop + 69.8, 8))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(32)
  const rwScoreStr = String(data.rw.scaled)
  doc.text(rwScoreStr, col2X, baseline(boxTop + 83.3, 32))
  {
    const w = doc.getTextWidth(rwScoreStr)
    const dividerX = col2X + w + 12
    doc.setDrawColor(...MINI_LINE)
    doc.setLineWidth(0.85)
    doc.line(dividerX, boxTop + 87.2, dividerX, boxTop + 105.9)
    const labelX = dividerX + 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Score Range:', labelX, baseline(boxTop + 88.6, 8))
    doc.setFont('helvetica', 'normal')
    doc.text('200-800', labelX, baseline(boxTop + 97.9, 8))
  }
  doc.setDrawColor(...BOX_LINE)
  doc.setLineWidth(1.1)
  dottedLine(doc, col2X, boxTop + 127.3, col2X + 127.3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Math', col2X, baseline(boxTop + 145.7, 8))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(32)
  const mathScoreStr = String(data.math.scaled)
  doc.text(mathScoreStr, col2X, baseline(boxTop + 159.2, 32))
  {
    const w = doc.getTextWidth(mathScoreStr)
    const dividerX = col2X + w + 12
    doc.setDrawColor(...MINI_LINE)
    doc.setLineWidth(0.85)
    doc.line(dividerX, boxTop + 163.1, dividerX, boxTop + 181.8)
    const labelX = dividerX + 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Score Range:', labelX, baseline(boxTop + 164.4, 8))
    doc.setFont('helvetica', 'normal')
    doc.text('200-800', labelX, baseline(boxTop + 173.8, 8))
  }

  // Column 3 — SCORE DETAILS
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('SCORE DETAILS', col3X, baseline(rowTop, 10))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Questions Overview', col3X, baseline(boxTop + 69.8, 8))

  const totalCorrect = data.rw.correct + data.math.correct
  const totalCorrectStr = String(totalCorrect)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(32)
  doc.text(totalCorrectStr, col3X, baseline(boxTop + 83.3, 32))
  {
    const w = doc.getTextWidth(totalCorrectStr)
    const div1 = col3X + w + 10
    doc.setDrawColor(...MINI_LINE)
    doc.setLineWidth(0.85)
    doc.line(div1, boxTop + 87.2, div1, boxTop + 105.9)
    const correctX = div1 + 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Correct', correctX, baseline(boxTop + 88.6, 8))
    doc.text('Answers', correctX, baseline(boxTop + 97.9, 8))
    const correctW = Math.max(doc.getTextWidth('Correct'), doc.getTextWidth('Answers'))
    const div2 = correctX + correctW + 10
    doc.line(div2, boxTop + 87.2, div2, boxTop + 105.9)
    const totalsX = div2 + 10
    doc.text(`Total Questions: ${data.rw.total + data.math.total}`, totalsX, baseline(boxTop + 88.6, 8))
    doc.text(`Total Incorrect: ${data.rw.incorrect + data.math.incorrect}`, totalsX, baseline(boxTop + 97.9, 8))
  }

  doc.setDrawColor(...BOX_LINE)
  doc.setLineWidth(1.1)
  dottedLine(doc, col3X, boxTop + 119.3, col3X + 181.5)

  const rwSubX = col3X
  const mathSubX = col3X + 102.7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Reading and Writing', rwSubX, baseline(boxTop + 133.7, 8))
  doc.text('Math', mathSubX, baseline(boxTop + 133.7, 8))

  function drawSubScore(x: number, correct: number, total: number, incorrect: number) {
    const correctStr = String(correct)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.text(correctStr, x, baseline(boxTop + 151.8, 24))
    const w = doc.getTextWidth(correctStr)
    const dividerX = x + w + 9
    doc.setDrawColor(...MINI_LINE)
    doc.setLineWidth(0.85)
    doc.line(dividerX, boxTop + 152.4, dividerX, boxTop + 171.1)
    const labelX = dividerX + 9
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Correct', labelX, baseline(boxTop + 153.7, 8))
    doc.text('Answers', labelX, baseline(boxTop + 163.1, 8))
    doc.text(`Total Questions: ${total}`, x, baseline(boxTop + 183.2, 8))
    doc.text(`Incorrect Answers: ${incorrect}`, x, baseline(boxTop + 192.6, 8))
  }
  drawSubScore(rwSubX, data.rw.correct, data.rw.total, data.rw.incorrect)
  drawSubScore(mathSubX, data.math.correct, data.math.total, data.math.incorrect)

  // Vertical dividers between the 3 main columns — span exactly between the two rules.
  doc.setDrawColor(...BOX_LINE)
  doc.setLineWidth(1.1)
  doc.line(div1X, rule1Y, div1X, boxTop + 211.7)
  doc.line(div2X, rule1Y, div2X, boxTop + 211.7)

  // Rule above Knowledge and Skills — edge to edge.
  const rule2Y = boxTop + 211.7
  doc.line(ruleLeft, rule2Y, ruleRight, rule2Y)

  /* --------------------------- Knowledge & Skills -------------------------- */
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('KNOWLEDGE AND SKILLS', boxLeft + 11, baseline(boxTop + 224.4, 10))
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('View your performance across the 8 content domains measured on the SAT', boxLeft + 11, baseline(boxTop + 242.6, 7))

  const rwColX = boxLeft + 11
  const mathColX = boxLeft + 290.3

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Reading and Writing', rwColX, baseline(boxTop + 267.2, 9))
  doc.text('Math', mathColX, baseline(boxTop + 267.2, 9))

  const domainRowH = 48.8
  const segW = 28
  const segH = 8
  const segGap = 3

  function drawDomainList(domains: typeof RW_DOMAINS, colX: number, startTop: number) {
    let rowTopY = startTop
    for (const d of domains) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(d.name, colX, baseline(rowTopY, 8))
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`(${d.blueprint})`, colX, baseline(rowTopY + 11.3, 8))

      const { correct, total } = domainStats(data.review, d.name)
      const filled = total > 0 ? Math.max(1, Math.round((correct / total) * SEGMENTS)) : 0
      const barTop = rowTopY + 29.3
      let sx = colX
      for (let i = 0; i < SEGMENTS; i++) {
        doc.setDrawColor(...BLACK)
        doc.setLineWidth(0.8)
        doc.setFillColor(i < filled ? 0 : 255, i < filled ? 0 : 255, i < filled ? 0 : 255)
        doc.rect(sx, barTop, segW, segH, 'FD')
        sx += segW + segGap
      }
      rowTopY += domainRowH
    }
    return rowTopY
  }

  const rwBottomTop = drawDomainList(RW_DOMAINS, rwColX, boxTop + 287.6)
  const mathBottomTop = drawDomainList(MATH_DOMAINS, mathColX, boxTop + 287.6)
  const lastRowBarBottom = Math.max(rwBottomTop, mathBottomTop) - domainRowH + 29.3 + segH

  const boxBottom = lastRowBarBottom + 21
  doc.setDrawColor(...BOX_LINE)
  doc.setLineWidth(1.1)
  doc.roundedRect(boxLeft, boxTop, boxRight - boxLeft, boxBottom - boxTop, 6, 6, 'S')

  /* -------------------------------- Footer -------------------------------- */
  const fy = boxBottom + 15.2
  const footerH = 68.2
  doc.setDrawColor(...BOX_LINE)
  doc.setLineWidth(1.1)
  doc.roundedRect(boxLeft, fy, boxRight - boxLeft, footerH, 8, 8, 'S')

  const iconR = 16
  const iconX = boxLeft + 9 + iconR
  const iconYc = fy + footerH / 2
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(1.0)
  doc.circle(iconX, iconYc, iconR, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...TEXT)
  doc.text('S', iconX, iconYc + 3.9, { align: 'center' })

  const qrSize = 48
  const qrX = boxRight - qrSize - 7
  const qrDividerX = qrX - 18

  const footerTextX = iconX + iconR + 15
  const footerTextRight = qrDividerX - 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const footerText = doc.splitTextToSize(
    "SAT AKADEMIYASI platformasida amaliy testlarni topshiring va natijalaringizni kuzatib boring.",
    footerTextRight - footerTextX,
  ) as string[]
  printLines(footerText, footerTextX, fy + 10, 9, 10.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('To learn more, scan the QR code', footerTextX, baseline(fy + 10 + footerText.length * 10.5 + 6, 9))

  // Vertical divider before the QR code — same light color as the box lines.
  doc.setDrawColor(...BOX_LINE)
  doc.setLineWidth(1.1)
  doc.line(qrDividerX, fy + 8, qrDividerX, fy + footerH - 8)

  const qrDataUrl: string = await QRCode.toDataURL('@SATAKADEMIYASI', {
    margin: 0,
    width: 240,
    color: { dark: '#000000', light: '#ffffff' },
  })
  doc.addImage(qrDataUrl, 'PNG', qrX, fy + (footerH - qrSize) / 2, qrSize, qrSize)

  /* ------------------------------- Copyright ------------------------------- */
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT)
  doc.text('\u00A9 SAT AKADEMIYASI by Usmon Xamroyev', boxLeft, baseline(fy + footerH + 26, 8))

  return doc
}
