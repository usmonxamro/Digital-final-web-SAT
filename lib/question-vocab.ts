/** One word of a question's vocabulary list (questions.vocab, jsonb array). */
export type VocabEntry = {
  /** The English word / phrase as it appears in the question. */
  w: string
  /** Uzbek meaning. */
  uz: string
  /** Optional short example / the phrase from the question. */
  ex?: string
}

/** Cleans whatever is stored/sent into a safe list: trimmed strings only, capped (a question never needs more). */
export function cleanVocab(raw: unknown, max = 12): VocabEntry[] {
  if (!Array.isArray(raw)) return []
  const out: VocabEntry[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const w = typeof o.w === 'string' ? o.w.trim().slice(0, 80) : ''
    const uz = typeof o.uz === 'string' ? o.uz.trim().slice(0, 160) : ''
    if (!w || !uz || seen.has(w.toLowerCase())) continue
    seen.add(w.toLowerCase())
    const ex = typeof o.ex === 'string' && o.ex.trim() ? o.ex.trim().slice(0, 200) : undefined
    out.push(ex ? { w, uz, ex } : { w, uz })
    if (out.length >= max) break
  }
  return out
}
