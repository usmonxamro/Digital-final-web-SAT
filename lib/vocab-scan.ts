import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Mock savollaridan lug'atni boyitadi (bepul, hech qanday tashqi tarjimon yoki API'siz):
 *  1) lug'atdagi so'zlar uchun savol matnidan MISOL gap topadi (kontekst/gap-to'ldirish quiz uchun) — faqat bo'sh joylarni to'ldiradi,
 *     admin yozgan misolga tegmaydi;
 *  2) lug'atda YO'Q, lekin savollarda ko'p uchraydigan so'zlarni "tarjima kutayotganlar" ro'yxatiga qo'shadi
 *     (admin tarjimasini yozib bir bosishda qo'shadi yoki rad etadi).
 * Yangi mock nashr qilinganda avtomatik, shuningdek admin paneldagi tugma orqali ishga tushadi.
 */

const STOP = new Set(
  `the and for are that this with from have has had was were will would could should can not but you your they them their there then than what which where when who whom whose how why
into onto over under out off all any each every some such many much more most less least other another also only just very too both either neither one two three four five six seven eight nine ten
its his her him she our ours who does did done been being get got gets let may might must shall per via yes about above after again against before below between during here once same own those these through until while
use used using make made makes take takes taken give gives given find finds found show shows shown following value values number numbers equation equations function functions point points line lines
frac dfrac circ sqrt overline cdot char text left right mathrm mathbf begin end quad qquad times cdots ldots leq geq neq approx pm tan sin cos log ln
january february march april june july august september october november december monday tuesday wednesday thursday friday saturday sunday`
    .split(/\s+/)
    .filter(Boolean),
)

/** LaTeX / HTML / markdown chiqindilarini olib tashlab, oddiy matn qoldiradi. */
export function plainText(raw: string): string {
  return raw
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}^_*`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Oddiy shakl o'zgarishlarini bir tomonga keltiradi (angles -> angle, measured -> measure). Taxminiy, faqat moslash uchun. */
export function stem(t: string): string {
  let s = t.toLowerCase()
  if (s.length > 4 && s.endsWith('ies')) s = s.slice(0, -3) + 'y'
  else if (s.length > 4 && s.endsWith('es') && /(s|x|z|ch|sh)es$/.test(s)) s = s.slice(0, -2)
  else if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1)
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3)
  else if (s.length > 4 && s.endsWith('ed')) s = s.slice(0, -2)
  else if (s.length > 5 && s.endsWith('ly')) s = s.slice(0, -2)
  if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1)
  return s
}

const goodExample = (s: string) => s.length >= 40 && s.length <= 160 && !/[\\$_]/.test(s) && (s.match(/\d/g)?.length ?? 0) <= 4 && /^[A-Z]/.test(s)

type WordRow = {
  id: number
  subject: string
  en: string
  uz: string
  cat: string
  example: string | null
  example_src: string | null
  needs_review: boolean
  active: boolean
  source: string
}

export type ScanResult = { questions: number; examplesAdded: number; candidates: number }

async function loadQuestions(sb: SupabaseClient) {
  const out: { id: string; test_label: string | null; prompt: string | null; passage: string | null }[] = []
  for (let from = 0; from < 20000; from += 500) {
    const { data, error } = await sb.from('questions').select('id, test_label, prompt, passage').order('id').range(from, from + 499)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 500) break
  }
  return out
}

export async function scanVocab(sb: SupabaseClient): Promise<ScanResult> {
  const [{ data: wordRows, error: wErr }, questions] = await Promise.all([
    sb.from('vocab_words').select('id, subject, en, uz, cat, example, example_src, needs_review, active, source').eq('subject', 'math').limit(5000),
    loadQuestions(sb),
  ])
  if (wErr) throw wErr
  const words = (wordRows ?? []) as WordRow[]

  // Lug'atdagi so'zlarning (va ibora bo'laklarining) o'zagi
  const known = new Set<string>()
  const single = new Map<string, WordRow[]>() // stem -> so'zlar
  for (const w of words) {
    const toks = w.en.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []
    for (const t of toks) known.add(stem(t))
    if (toks.length === 1 && w.active) {
      const k = stem(toks[0])
      single.set(k, [...(single.get(k) ?? []), w])
    }
  }

  const best = new Map<number, { s: string; src: string; score: number }>()
  const docsCount = new Map<string, number>()
  const candExample = new Map<string, { s: string; src: string }>()

  for (const q of questions) {
    const txt = plainText(`${q.passage ?? ''} ${q.prompt ?? ''}`)
    if (!txt) continue
    const src = q.test_label ?? ''
    const seenInDoc = new Set<string>()
    for (const sent of sentencesOf(txt)) {
      const toks = sent.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
      const ok = goodExample(sent)
      for (const raw of toks) {
        const k = stem(raw)
        const hit = single.get(k)
        if (hit && ok) {
          for (const w of hit) {
            if (w.example) continue
            const score = Math.abs(sent.length - 90) // ~90 belgili gap eng yaxshi
            const cur = best.get(w.id)
            if (!cur || score < cur.score) best.set(w.id, { s: sent, src, score })
          }
        }
        if (!hit && !known.has(k)) {
          const low = raw.toLowerCase()
          if (low.length >= 4 && /^[a-z]+$/.test(low) && !STOP.has(low) && !STOP.has(k) && !seenInDoc.has(k)) {
            seenInDoc.add(k)
            docsCount.set(low, (docsCount.get(low) ?? 0) + 1)
            if (ok && !candExample.has(low)) candExample.set(low, { s: sent, src })
          }
        }
      }
    }
  }

  // 1) misollarni yozamiz (faqat bo'sh joylarga)
  const updates = words
    .filter((w) => best.has(w.id))
    .map((w) => ({ ...w, example: best.get(w.id)!.s, example_src: best.get(w.id)!.src || null, updated_at: new Date().toISOString() }))
  for (let i = 0; i < updates.length; i += 200) {
    const { error } = await sb.from('vocab_words').upsert(updates.slice(i, i + 200), { onConflict: 'id' })
    if (error) throw error
  }

  // 2) tarjima kutayotgan so'zlar (faqat hali "new" yoki yo'q bo'lganlar; rad etilgan/qo'shilganlarga tegilmaydi)
  const { data: existing } = await sb.from('vocab_candidates').select('word, status').eq('subject', 'math').limit(5000)
  const skip = new Set((existing ?? []).filter((c) => c.status !== 'new').map((c) => c.word as string))
  const top = [...docsCount.entries()]
    .filter(([w, n]) => n >= 3 && !skip.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 200)
  const rows = top.map(([word, docs]) => ({
    subject: 'math',
    word,
    docs,
    example: candExample.get(word)?.s ?? null,
    example_src: candExample.get(word)?.src ?? null,
    status: 'new',
    updated_at: new Date().toISOString(),
  }))
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from('vocab_candidates').upsert(rows.slice(i, i + 200), { onConflict: 'subject,word' })
    if (error) throw error
  }
  return { questions: questions.length, examplesAdded: updates.length, candidates: rows.length }
}
