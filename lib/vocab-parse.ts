import { cleanVocab, type VocabEntry } from '@/lib/question-vocab'

/** question number (or order, for TeX) → words. */
export type ParsedVocab = { byNumber: Map<number, VocabEntry[]>; format: 'tex' | 'json' | 'text'; ordered: boolean }

/** Strips the little LaTeX that appears inside vocabulary entries. */
function untex(s: string): string {
  return s
    .replace(/\\textbf\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:emph|textit)\{([^{}]*)\}/g, '$1')
    .replace(/\\([&_%#$])/g, '$1')
    .replace(/\$/g, '')
    .replace(/\\[a-zA-Z]+\*?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const BRACED = String.raw`((?:[^{}]|\{[^{}]*\})*)`

function parseTex(src: string): ParsedVocab {
  const body = src.includes('\\begin{document}') ? src.slice(src.indexOf('\\begin{document}')) : src
  const qRe = /\\(?:short|tall|compact|mini)?question\{(\d+)\}/g
  const eRe = new RegExp(String.raw`\\entry\{${BRACED}\}\{${BRACED}\}`, 'g')
  const qs: { at: number }[] = []
  for (let m; (m = qRe.exec(body)); ) qs.push({ at: m.index })
  const byNumber = new Map<number, VocabEntry[]>()
  for (let m; (m = eRe.exec(body)); ) {
    let k = -1
    for (let i = 0; i < qs.length && qs[i].at < m.index; i++) k = i
    if (k < 0) continue
    const w = untex(m[1])
    const uz = untex(m[2])
    if (!w || !uz) continue
    const list = byNumber.get(k + 1) ?? []
    list.push({ w, uz })
    byNumber.set(k + 1, list)
  }
  // TeX: the k-th question block is the k-th question (numbers in a file may restart per module)
  return { byNumber, format: 'tex', ordered: true }
}

function parseJson(src: string): ParsedVocab | null {
  let data: unknown
  try {
    data = JSON.parse(src)
  } catch {
    return null
  }
  const byNumber = new Map<number, VocabEntry[]>()
  const put = (n: number, v: unknown) => {
    const list = cleanVocab(
      Array.isArray(v)
        ? v.map((x) => (Array.isArray(x) ? { w: x[0], uz: x[1] } : x))
        : typeof v === 'string'
          ? parseEntries(v)
          : [],
    )
    if (Number.isFinite(n) && list.length) byNumber.set(n, list)
  }
  if (Array.isArray(data)) {
    for (const row of data) if (row && typeof row === 'object') put(Number((row as { n?: unknown; q?: unknown }).n ?? (row as { q?: unknown }).q), (row as { vocab?: unknown }).vocab)
  } else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) put(Number(k), v)
  } else return null
  return { byNumber, format: 'json', ordered: false }
}

/** "word = meaning; word2 = meaning2" (also "—" / "–" / " - " as separator, newline as ";"). */
function parseEntries(s: string): VocabEntry[] {
  const out: VocabEntry[] = []
  for (const part of s.split(/;|\n/)) {
    const m = part.match(/^\s*(.+?)\s*(?:=|—|–|\s-\s|:)\s*(.+?)\s*$/)
    if (m) out.push({ w: m[1].replace(/^\*+|\*+$/g, '').trim(), uz: m[2].trim() })
  }
  return out
}

function parseText(src: string): ParsedVocab {
  const byNumber = new Map<number, VocabEntry[]>()
  let cur = -1
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^(?:savol|question|q|#)?\s*(\d{1,3})\s*[:.)|\-–—]\s*(.*)$/i)
    let rest = line
    if (m) {
      cur = Number(m[1])
      rest = m[2]
    }
    if (cur < 0) continue
    const list = parseEntries(rest)
    if (list.length) byNumber.set(cur, [...(byNumber.get(cur) ?? []), ...list])
  }
  return { byNumber, format: 'text', ordered: false }
}

/** Understands: the TeX of a "lug‘atli" PDF (\entry{word}{meaning}), JSON, or plain "12: word = meaning; ..." lines. */
export function parseVocabSource(src: string): ParsedVocab {
  const t = src.trim()
  if (t.includes('\\entry{')) return parseTex(t)
  if (t.startsWith('{') || t.startsWith('[')) {
    const j = parseJson(t)
    if (j) return j
  }
  return parseText(t)
}
