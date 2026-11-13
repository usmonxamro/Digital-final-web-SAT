import { plainText, stem, STOP } from '@/lib/vocab-scan'

/**
 * Per-question vocabulary suggestions from the site's word list (vocab_words).
 * Pure logic (server and tests): no database access here.
 *
 *  1. Every dictionary entry becomes one or more phrases ("large / larger", "axis (axes)" are split), each a sequence of word stems.
 *  2. The question text (passage + prompt + answer choices) is scanned left to right; the LONGEST phrase wins at each position
 *     ("height of a triangle" beats "height"), and the words it covers are not suggested again on their own.
 *  3. A suggestion is "recommended" (ticked by default) unless it is trivial grammar/number words, or it appears in a big share
 *     of the mock's questions ("value", "equation"…) — a student sees those everywhere, they do not belong under every question.
 *  4. Words that are not in the dictionary but look like real vocabulary are returned as `unknown` (the admin may add them by hand).
 */

export type DictWord = { en: string; uz: string }
export type Suggestion = { w: string; uz: string; rec: boolean; common: boolean }
export type QuestionSuggestions = { suggestions: Suggestion[]; unknown: string[] }
export type QuestionText = { passage?: string | null; prompt?: string | null; choices?: unknown }

/** Entries of the list that are grammar / numbers / directions, not vocabulary worth a box under a question. */
const TRIVIAL = new Set(
  `he she it its his her they them at in on of for from to through after before above below one two three four five six seven eight nine ten hundred thousands thousand million
  first second third fourth fifth sixth tenth take took give given make use using work large larger largest small smaller smallest more less most short shorter long longer same some
  all few part show next last time single both about over under inside top bottom half whole`
    .split(/\s+/)
    .filter(Boolean),
)

const tokens = (s: string) => s.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []

/** "large / larger / largest" → 3 phrases, "axis (axes)" → "axis", "axes". */
function variants(en: string): string[] {
  const out: string[] = []
  for (const part of en.split(/\s*\/\s*/)) {
    const paren = [...part.matchAll(/\(([^)]*)\)/g)].map((m) => m[1])
    const base = part.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
    if (base) out.push(base)
    for (const p of paren) if (/^[A-Za-z' -]+$/.test(p)) out.push(p.trim())
  }
  return out
}

type Phrase = { en: string; uz: string; stems: string[]; trivial: boolean }

export function buildIndex(words: DictWord[]): Map<string, Phrase[]> {
  const idx = new Map<string, Phrase[]>()
  for (const w of words) {
    for (const v of variants(w.en)) {
      const toks = tokens(v)
      if (toks.length === 0) continue
      const stems = toks.map(stem)
      const trivial = toks.every((t) => TRIVIAL.has(t) || t.length < 3) || (toks.length === 1 && TRIVIAL.has(toks[0]))
      const list = idx.get(stems[0]) ?? []
      list.push({ en: v.trim(), uz: w.uz.trim(), stems, trivial })
      idx.set(stems[0], list)
    }
  }
  for (const list of idx.values()) list.sort((a, b) => b.stems.length - a.stems.length) // longest phrase first
  return idx
}

/** The text a student reads in one question: passage, prompt and the text of the answer choices. */
export function questionText(q: QuestionText): string {
  const ch = Array.isArray(q.choices) ? (q.choices as { text?: string }[]).map((c) => c?.text ?? '').join(' . ') : ''
  return plainText(`${q.passage ?? ''} ${q.prompt ?? ''} ${ch}`)
}

type Found = { key: string; en: string; uz: string; trivial: boolean; len: number }

function scan(text: string, idx: Map<string, Phrase[]>): { found: Found[]; unknownRaw: string[] } {
  const raw = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
  const st = raw.map((t) => stem(t))
  const found: Found[] = []
  const seen = new Set<string>()
  const covered = new Array(raw.length).fill(false)
  for (let i = 0; i < raw.length; i++) {
    const cands = idx.get(st[i])
    if (!cands) continue
    for (const p of cands) {
      let ok = i + p.stems.length <= raw.length
      for (let k = 0; ok && k < p.stems.length; k++) if (st[i + k] !== p.stems[k]) ok = false
      if (!ok) continue
      const key = p.stems.join(' ')
      if (!seen.has(key)) {
        seen.add(key)
        found.push({ key, en: p.en, uz: p.uz, trivial: p.trivial, len: p.stems.length })
      }
      for (let k = 0; k < p.stems.length; k++) covered[i + k] = true
      i += p.stems.length - 1
      break
    }
  }
  const knownStems = new Set<string>()
  for (const list of idx.values()) for (const p of list) for (const s of p.stems) knownStems.add(s)
  const unknownRaw: string[] = []
  const us = new Set<string>()
  raw.forEach((t, i) => {
    const low = t.toLowerCase()
    if (covered[i] || knownStems.has(st[i]) || low.length < 6 || !/^[a-z]+$/.test(low) || STOP.has(low) || STOP.has(st[i]) || us.has(st[i])) return
    us.add(st[i])
    unknownRaw.push(low)
  })
  return { found, unknownRaw }
}

/**
 * Suggestions for all questions of one mock. `commonShare` — a word found in at least this share of the questions
 * (and in at least `commonMin` questions) is "common" and not ticked by default.
 */
export function suggestForMock(questions: QuestionText[], words: DictWord[], opts: { commonShare?: number; commonMin?: number; maxRec?: number } = {}): QuestionSuggestions[] {
  const { commonShare = 0.2, commonMin = 4, maxRec = 8 } = opts
  const idx = buildIndex(words)
  const scans = questions.map((q) => scan(questionText(q), idx))
  const df = new Map<string, number>()
  const udf = new Map<string, number>()
  for (const s of scans) {
    for (const f of s.found) df.set(f.key, (df.get(f.key) ?? 0) + 1)
    for (const u of s.unknownRaw) udf.set(u, (udf.get(u) ?? 0) + 1)
  }
  const n = Math.max(1, questions.length)
  const isCommon = (c: number) => c >= commonMin && c / n >= commonShare
  return scans.map((s) => {
    const rows: (Suggestion & { score: number })[] = s.found.filter((f) => !f.trivial).map((f) => {
      const c = df.get(f.key) ?? 1
      const common = isCommon(c)
      const rec = !common
      // phrases first, then longer / rarer words
      const score = (rec ? 1000 : 0) + f.len * 100 + Math.min(f.en.length, 30) - c
      return { w: f.en, uz: f.uz, rec, common, score }
    })
    rows.sort((a, b) => b.score - a.score)
    let recLeft = maxRec
    const suggestions = rows.map(({ score: _s, ...r }) => {
      if (r.rec) {
        if (recLeft > 0) recLeft--
        else r.rec = false
      }
      return r
    })
    const unknown = s.unknownRaw
      .filter((u) => !isCommon(udf.get(u) ?? 1))
      .sort((a, b) => b.length - a.length)
      .slice(0, 8)
    return { suggestions, unknown }
  })
}
