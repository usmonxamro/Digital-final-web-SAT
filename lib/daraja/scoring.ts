import { rawToScaled } from './scale'
import type { Lang, Prep } from './types'

export interface KeyRow {
  module: number; n: number; type: 'mcq' | 'gridin'
  correct: string | null; correct_value: string | null
  domain: string | null; sat_format: boolean
}

export function normNum(s: string): string {
  const t = s.trim().replace(/\s+/g, '').replace(',', '.')
  const v = Number(t)
  return t !== '' && Number.isFinite(v) ? String(v) : t.toLowerCase()
}

export function isCorrect(k: KeyRow, given: unknown): boolean {
  if (typeof given !== 'string' || !given) return false
  return k.type === 'mcq' ? given.toUpperCase() === k.correct : normNum(given) === normNum(k.correct_value ?? '')
}

/**
 * Adolat qoidasi: SAT formatiga xos savollar (M2 14, 15, 20) maktab dasturida yo‘q. «Umuman tayyorlanmagan» yoki
 * «ozgina» tayyorlangan o‘quvchi ularni xato qilsa — hisobga olinmaydi (to‘g‘ri bo‘lsa — hisoblanadi).
 */
export function score(keys: KeyRow[], answers: Record<string, string>, prep: Prep) {
  const relax = prep === 'none' || prep === 'little'
  let correct = 0, fmtCorrect = 0, fmtTotal = 0
  const detail: Record<string, boolean> = {}
  const dom: Record<string, { c: number; t: number }> = {}
  for (const k of keys) {
    const ok = isCorrect(k, answers[`${k.module}-${k.n}`])
    detail[`${k.module}-${k.n}`] = ok
    if (ok) correct++
    if (k.sat_format) { fmtTotal++; if (ok) fmtCorrect++ }
    const d = (dom[k.domain ?? '—'] ??= { c: 0, t: 0 }); d.t++; if (ok) d.c++
  }
  const total = keys.length
  const pct = relax ? correct / (total - fmtTotal + fmtCorrect) : correct / total
  const raw44 = Math.min(44, Math.round(pct * 44))
  return { correct, total, raw44, scaled: rawToScaled(raw44), relaxed: relax && fmtCorrect < fmtTotal, detail, domains: dom }
}

export type Band = 'start' | 'base' | 'mid' | 'high' | 'top'
export function band(scaled: number): Band {
  return scaled < 500 ? 'start' : scaled < 650 ? 'base' : scaled < 720 ? 'mid' : scaled < 800 ? 'high' : 'top'
}
export function isLang(v: unknown): v is Lang { return v === 'uz' || v === 'en' }
