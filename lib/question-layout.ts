/**
 * Visual layout of a question's stimulus — the "blocks" an admin can drag
 * around in the exam preview (Check it now): prompt paragraphs, tables, the
 * figure, and display equations, stacked in rows, with up to 3 side by side.
 *
 * Storage:
 *   - `layout` (jsonb column) = { v: 1, rows: [["img","p0"],["eq0"],["p1"]] }
 *   - Once a layout exists, `prompt` is written as blank-line-separated chunks
 *     in the on-screen reading order, chunk i ⇔ block id "p{i}". So screens
 *     that don't know about layouts (score report, review) still read the
 *     prompt in the right order.
 *   - "img" = question.image, "eq{i}" = question.equations[i].
 *
 * Everything here is pure (no React) so it can be shared by the renderer,
 * the editor and tests.
 */

/**
 * Per-block fine-tuning set by dragging handles in the preview editor:
 *  mt / mb  extra space above / below the block, px (negative = tighter)
 *  dx       horizontal shift of the block's content, px
 *  scale    proportional size of a table or an equation (1 = normal)
 */
export type BlockStyle = { mt?: number; mb?: number; dx?: number; scale?: number }

export type QuestionLayout = {
  v: 1
  rows: string[][]
  /** Figure's default size, × its automatic size (set by the admin in the preview). */
  img?: { scale: number }
  /** Keyed by block id (p0…, img, eq0…). */
  styles?: Record<string, BlockStyle>
}

export const STYLE_LIMITS = {
  margin: [-60, 120] as const,
  dx: [-400, 400] as const,
  scale: [0.4, 3] as const,
}

const clampN = (v: unknown, [lo, hi]: readonly [number, number], digits = 0) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  const f = 10 ** digits
  return Math.round(Math.min(hi, Math.max(lo, n)) * f) / f
}

/** Clamps a style and drops neutral values; undefined when nothing is left. */
export function cleanStyle(raw: unknown): BlockStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const out: BlockStyle = {}
  const mt = clampN(r.mt, STYLE_LIMITS.margin)
  const mb = clampN(r.mb, STYLE_LIMITS.margin)
  const dx = clampN(r.dx, STYLE_LIMITS.dx)
  const scale = clampN(r.scale, STYLE_LIMITS.scale, 2)
  if (mt) out.mt = mt
  if (mb) out.mb = mb
  if (dx) out.dx = dx
  if (scale !== undefined && Math.abs(scale - 1) > 0.001) out.scale = scale
  return Object.keys(out).length ? out : undefined
}

/** Validates a layout coming from the browser (API side). */
export function sanitizeLayout(raw: unknown): QuestionLayout | null | undefined {
  if (raw === null) return null
  if (!raw || typeof raw !== 'object') return undefined
  const l = raw as { rows?: unknown; img?: { scale?: unknown }; styles?: unknown }
  if (!Array.isArray(l.rows)) return undefined
  const rows: string[][] = []
  for (const row of l.rows) {
    if (!Array.isArray(row) || !row.every((x) => typeof x === 'string' && x.length <= 12)) return undefined
    if (row.length) rows.push(row.slice(0, MAX_PER_ROW) as string[])
  }
  const layout: QuestionLayout = { v: 1, rows }
  const scale = clampN(l.img?.scale, STYLE_LIMITS.scale, 2)
  if (scale !== undefined && Math.abs(scale - 1) > 0.001) layout.img = { scale: Math.max(0.3, scale) }
  if (l.styles && typeof l.styles === 'object') {
    const styles: Record<string, BlockStyle> = {}
    for (const [id, st] of Object.entries(l.styles as Record<string, unknown>).slice(0, 200)) {
      if (!/^(p\d{1,3}|img|eq\d{1,2})$/.test(id)) continue
      const c = cleanStyle(st)
      if (c) styles[id] = c
    }
    if (Object.keys(styles).length) layout.styles = styles
  }
  return layout
}

export type BlockKind = 'text' | 'table' | 'image' | 'equation'
export type LayoutBlock = { id: string; kind: BlockKind; content: string }

export const MAX_PER_ROW = 3

type LayoutSource = {
  prompt: string
  image?: string
  equations?: string[]
  layout?: QuestionLayout | null
}

/* ------------------------------ text parsing ------------------------------ */

/** A line is a table row when it has at least one "|" cell separator. */
export function isTableRow(line: string) {
  return line.includes('|') && line.split('|').length >= 2 && line.trim().length > 1
}

export type TextPiece = { kind: 'text'; text: string } | { kind: 'table'; rows: string[][] }

/** Groups ≥2 consecutive "a | b" lines into tables; everything else is text. */
export function parseRichText(text: string): TextPiece[] {
  const lines = text.split('\n')
  const out: TextPiece[] = []
  let textBuf: string[] = []
  let rowBuf: string[][] = []

  const flushText = () => {
    if (textBuf.length) out.push({ kind: 'text', text: textBuf.join('\n') })
    textBuf = []
  }
  const flushRows = () => {
    if (rowBuf.length >= 2) {
      flushText()
      out.push({ kind: 'table', rows: rowBuf })
    } else if (rowBuf.length === 1) {
      textBuf.push(rowBuf[0].join(' | '))
    }
    rowBuf = []
  }

  for (const line of lines) {
    if (isTableRow(line)) rowBuf.push(line.split('|').map((c) => c.trim()))
    else {
      flushRows()
      textBuf.push(line)
    }
  }
  flushRows()
  flushText()
  return out
}

function kindOfChunk(chunk: string): BlockKind {
  const lines = chunk.split('\n').filter((l) => l.trim())
  return lines.length >= 2 && lines.every(isTableRow) ? 'table' : 'text'
}

/**
 * The prompt's blocks.
 *  - With a saved layout: one block per blank-line-separated chunk.
 *  - Without (fresh import): one block per non-empty line, tables grouped —
 *    the finest useful granularity for the editor's first pass.
 */
export function promptBlocks(prompt: string, hasLayout: boolean): LayoutBlock[] {
  const contents: string[] = []
  if (hasLayout) {
    for (const chunk of prompt.split(/\n[ \t]*\n/)) {
      const c = chunk.replace(/^\n+|\n+$/g, '')
      if (c.trim()) contents.push(c)
    }
  } else {
    for (const piece of parseRichText(prompt)) {
      if (piece.kind === 'table') contents.push(piece.rows.map((r) => r.join(' | ')).join('\n'))
      else for (const line of piece.text.split('\n')) if (line.trim()) contents.push(line)
    }
  }
  return contents.map((content, i) => ({ id: `p${i}`, kind: kindOfChunk(content), content }))
}

/** All blocks of a question. Reading questions keep their figure in the
 *  passage pane, so `withFigure` is false there. */
export function questionBlocks(q: LayoutSource, withFigure: boolean): LayoutBlock[] {
  const blocks: LayoutBlock[] = []
  if (withFigure && q.image) blocks.push({ id: 'img', kind: 'image', content: q.image })
  if (withFigure) (q.equations ?? []).forEach((tex, i) => blocks.push({ id: `eq${i}`, kind: 'equation', content: tex }))
  blocks.push(...promptBlocks(q.prompt, !!q.layout))
  return blocks
}

/** Rows to draw: the saved layout, cleaned up (unknown ids dropped, duplicates
 *  removed, blocks the layout doesn't mention appended at the end), or the
 *  default Bluebook order (figure, equations, then the prompt). */
export function resolveRows(q: LayoutSource, withFigure: boolean): { blocks: Map<string, LayoutBlock>; rows: string[][] } {
  const list = questionBlocks(q, withFigure)
  const blocks = new Map(list.map((b) => [b.id, b]))
  const seen = new Set<string>()
  const rows: string[][] = []
  if (q.layout?.rows) {
    for (const row of q.layout.rows) {
      const clean = (Array.isArray(row) ? row : []).filter((id) => blocks.has(id) && !seen.has(id)).slice(0, MAX_PER_ROW)
      clean.forEach((id) => seen.add(id))
      if (clean.length) rows.push(clean)
    }
  }
  for (const b of list) if (!seen.has(b.id)) rows.push([b.id])
  return { blocks, rows }
}

/* ------------------------------ serialization ----------------------------- */

/**
 * Turns an edited block arrangement back into { prompt, layout }.
 * Prompt chunks are renumbered p0..pn in on-screen order. A text block whose
 * content gained a blank line is split there into separate blocks (stacked
 * right below it) — that's how "cut this sentence out" works in the editor.
 */
export function serializeLayout(
  blocks: Map<string, LayoutBlock>,
  rows: string[][],
  img?: { scale: number },
  styles?: Record<string, BlockStyle>,
): { prompt: string; layout: QuestionLayout } {
  const chunks: string[] = []
  const outRows: string[][] = []
  // Prompt blocks are renumbered below; their styles follow them.
  const outStyles: Record<string, BlockStyle> = {}
  const keepStyle = (from: string, to: string) => {
    const c = cleanStyle(styles?.[from])
    if (c) outStyles[to] = c
  }

  for (const row of rows) {
    const outRow: string[] = []
    const extraRows: string[][] = []
    for (const id of row) {
      const b = blocks.get(id)
      if (!b) continue
      if (b.kind === 'image' || b.kind === 'equation') {
        outRow.push(id)
        keepStyle(id, id)
        continue
      }
      const parts = b.content
        .split(/\n[ \t]*\n/)
        .map((p) => p.replace(/^\n+|\n+$/g, ''))
        .filter((p) => p.trim())
      if (parts.length === 0) continue
      parts.forEach((part, k) => {
        const newId = `p${chunks.length}`
        chunks.push(part)
        if (k === 0) {
          outRow.push(newId)
          keepStyle(id, newId)
        } else extraRows.push([newId])
      })
    }
    if (outRow.length) outRows.push(outRow)
    outRows.push(...extraRows)
  }

  const layout: QuestionLayout = { v: 1, rows: outRows }
  if (img && Math.abs(img.scale - 1) > 0.001) layout.img = { scale: img.scale }
  if (Object.keys(outStyles).length) layout.styles = outStyles
  return { prompt: chunks.join('\n\n'), layout }
}

/* ------------------------------ row operations ---------------------------- */

export type DropTarget =
  | { kind: 'gap'; rowIndex: number } // new row inserted before rows[rowIndex]
  | { kind: 'side'; targetId: string; side: 'left' | 'right' }

function withoutId(rows: string[][], id: string): string[][] {
  return rows.map((r) => r.filter((x) => x !== id)).filter((r) => r.length > 0)
}

/** Moves block `id` to a drop target; returns the new rows (unchanged if the move is invalid). */
export function moveBlock(rows: string[][], id: string, target: DropTarget): string[][] {
  if (target.kind === 'side' && target.targetId === id) return rows
  // Gap indices refer to the ORIGINAL rows; adjust for the row that may vanish.
  if (target.kind === 'gap') {
    const fromRow = rows.findIndex((r) => r.includes(id))
    const removedWholeRow = fromRow !== -1 && rows[fromRow].length === 1
    let at = target.rowIndex
    if (removedWholeRow && fromRow < at) at -= 1
    const next = withoutId(rows, id)
    next.splice(Math.max(0, Math.min(at, next.length)), 0, [id])
    return next
  }
  const next = withoutId(rows, id)
  const ri = next.findIndex((r) => r.includes(target.targetId))
  if (ri === -1) return rows
  if (next[ri].length >= MAX_PER_ROW) return rows
  const ci = next[ri].indexOf(target.targetId)
  next[ri] = [...next[ri]]
  next[ri].splice(target.side === 'left' ? ci : ci + 1, 0, id)
  return next
}

/** ↑ / ↓ buttons: moves the block into its own row one step up / down. */
export function nudgeBlock(rows: string[][], id: string, dir: -1 | 1): string[][] {
  const ri = rows.findIndex((r) => r.includes(id))
  if (ri === -1) return rows
  if (rows[ri].length > 1) {
    // Leave the side-by-side row first, landing just above/below it.
    return moveBlock(rows, id, { kind: 'gap', rowIndex: dir === -1 ? ri : ri + 1 })
  }
  const target = ri + dir
  if (target < 0 || target >= rows.length) return rows
  const next = [...rows]
  ;[next[ri], next[target]] = [next[target], next[ri]]
  return next
}

/** "Yonma-yon" toggle: a lone block joins the row above; a block in a shared row gets its own row below. */
export function toggleSideBySide(rows: string[][], id: string): string[][] {
  const ri = rows.findIndex((r) => r.includes(id))
  if (ri === -1) return rows
  if (rows[ri].length > 1) return moveBlock(rows, id, { kind: 'gap', rowIndex: ri + 1 })
  if (ri === 0 || rows[ri - 1].length >= MAX_PER_ROW) return rows
  const prev = rows[ri - 1]
  return moveBlock(rows, id, { kind: 'side', targetId: prev[prev.length - 1], side: 'right' })
}

/** Splits a text into sentences, never inside $…$ math. */
export function splitSentences(text: string): string[] {
  const out: string[] = []
  let buf = ''
  let inMath = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    buf += ch
    if (ch === '$' && text[i - 1] !== '\\') inMath = !inMath
    if (!inMath && (ch === '.' || ch === '?' || ch === '!')) {
      const rest = text.slice(i + 1)
      const m = rest.match(/^(\s+)(["'“(]?[A-Z$])/)
      if (m) {
        out.push(buf.trim())
        buf = ''
        i += m[1].length
      }
    }
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}
