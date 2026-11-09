/**
 * Lug'at (Vocabulary) — sayt va quiz uchun umumiy, "sof" mantiq (server ham, brauzer ham ishlatadi).
 *
 * Yuklamani kamaytirish uchun savollar SERVERDA emas, brauzerda tuziladi: server faqat so'zlar
 * ro'yxatini (keshlangan) va o'quvchi taraqqiyotini beradi, natijalar esa quiz tugagach BITTA so'rovda yuboriladi.
 *
 * Intervalli takrorlash (Leitner): xato -> 0-quti (ertaga qaytadi), to'g'ri -> quti +1, qaytish oralig'i 1/3/7/14/30 kun.
 * Telegram bot ham AYNAN shu qoidadan foydalanadi (bot_vocab.py).
 */

export type VocabSubject = 'math' | 'english'

export type VocabWord = {
  id: number
  en: string
  uz: string
  cat: string
  example?: string | null
}

export type VocabProgress = {
  word_id: number
  box: number
  right_n: number
  wrong_n: number
  last_wrong_at: string | null
  due_at: string
}

export type QuizKind = 'en2uz' | 'uz2en' | 'cloze'

export type QuizQuestion = {
  wordId: number
  kind: QuizKind
  /** Savol matni (o'zbekcha yoki inglizcha) */
  prompt: string
  /** Kontekst quiz uchun: bo'sh joyli gap */
  sentence?: string
  options: string[]
  answer: number
  /** To'g'ri javob tushuntirishi: "en = uz" */
  explain: string
}

export const BOX_MAX = 5
/** quti -> necha kundan keyin qayta so'raladi */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const
export const WEEK_MS = 7 * 24 * 3600 * 1000
export const DEFAULT_SECONDS = 25
export const DEFAULT_COUNT = 10

/* ------------------------------ yordamchilar ------------------------------ */

export function shuffle<T>(arr: readonly T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** Quiz variantiga sig'adigan qisqa ko'rinish (Telegram variant <= 95 belgi, saytda ham chiroyli). */
export function clip(s: string, n = 95): string {
  const t = s.trim()
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…'
}

/* ------------------------------ Leitner holati ------------------------------ */

export type LeitnerState = { box: number; right_n: number; wrong_n: number; last_wrong_at: string | null; due_at: string }

export function nextState(prev: Partial<LeitnerState> | null | undefined, ok: boolean, now: Date = new Date()): LeitnerState {
  const box0 = Math.min(BOX_MAX, Math.max(0, prev?.box ?? 0))
  const right_n = (prev?.right_n ?? 0) + (ok ? 1 : 0)
  const wrong_n = (prev?.wrong_n ?? 0) + (ok ? 0 : 1)
  if (!ok) {
    // Xato: 0-qutiga qaytadi, ertasiga yana so'raladi.
    return { box: 0, right_n, wrong_n, last_wrong_at: now.toISOString(), due_at: new Date(now.getTime() + 24 * 3600 * 1000).toISOString() }
  }
  const box = Math.min(BOX_MAX, box0 + 1)
  const due = new Date(now.getTime() + INTERVAL_DAYS[box] * 24 * 3600 * 1000)
  return { box, right_n, wrong_n, last_wrong_at: prev?.last_wrong_at ?? null, due_at: due.toISOString() }
}

/** Qaysi so'zlarni takrorlash kerak: muddati kelgan yoki oxirgi 7 kunda xato qilingan va hali yaxshi o'zlashtirilmagan. */
export function isDue(p: Pick<VocabProgress, 'due_at' | 'box' | 'last_wrong_at'>, now: Date = new Date()): boolean {
  return new Date(p.due_at).getTime() <= now.getTime()
}
export function isWeeklyMistake(p: Pick<VocabProgress, 'box' | 'last_wrong_at'>, now: Date = new Date()): boolean {
  if (!p.last_wrong_at) return false
  return now.getTime() - new Date(p.last_wrong_at).getTime() <= WEEK_MS && p.box <= 2
}

/* ------------------------------ savol tuzish ------------------------------ */

/** Bir xil o'zbekcha tarjimali so'zlar soni — uz->en savolda ikki xil to'g'ri javob chiqmasligi uchun. */
export function uzCounts(words: readonly VocabWord[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const w of words) m.set(norm(w.uz), (m.get(norm(w.uz)) ?? 0) + 1)
  return m
}

/** Gapdagi so'zni ____ bilan almashtiradi (oddiy qo'shimchalar bilan: s, es, ed, ing, d). null = gapda topilmadi. */
export function makeCloze(example: string, en: string): string | null {
  const base = en.trim()
  if (!base || base.includes(' ')) return null
  const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const stem = esc.length > 4 && /e$/i.test(esc) ? esc.slice(0, -1) : esc
  const re = new RegExp(`\\b(?:${esc}|${stem})(?:s|es|ed|d|ing|ly)?\\b`, 'i')
  if (!re.test(example)) return null
  return example.replace(re, '_____')
}

type Opts = { words: readonly VocabWord[]; uzCount?: Map<string, number>; rnd?: () => number }

/** `count` ta noto'g'ri variant: avval shu kategoriyadan, yetmasa boshqalardan. */
function distractors(target: VocabWord, field: 'uz' | 'en', words: readonly VocabWord[], rnd: () => number, count = 3): string[] {
  const used = new Set<string>([norm(target[field])])
  const out: string[] = []
  const same = shuffle(words.filter((w) => w.id !== target.id && w.cat === target.cat), rnd)
  const rest = shuffle(words.filter((w) => w.id !== target.id && w.cat !== target.cat), rnd)
  for (const w of [...same, ...rest]) {
    if (out.length >= count) break
    const v = clip(w[field])
    const k = norm(v)
    if (used.has(k) || norm(w[field]) === norm(target[field])) continue
    // "(" yoki izohli uzun javoblarni boshqa so'zga o'xshatmaslik uchun: bir xil uzunlik oralig'ini afzal ko'ramiz — shart emas.
    used.add(k)
    out.push(v)
  }
  return out
}

export function makeQuestion(word: VocabWord, kind: QuizKind, o: Opts): QuizQuestion | null {
  const rnd = o.rnd ?? Math.random
  const counts = o.uzCount ?? uzCounts(o.words)
  let k = kind
  if (k === 'uz2en' && (counts.get(norm(word.uz)) ?? 0) > 1) k = 'en2uz'
  let sentence: string | undefined
  if (k === 'cloze') {
    const c = word.example ? makeCloze(word.example, word.en) : null
    if (!c) k = 'en2uz'
    else sentence = clip(c, 190)
  }

  const explain = `${word.en} = ${clip(word.uz, 120)}`
  if (k === 'uz2en' || k === 'cloze') {
    const wrong = distractors(word, 'en', o.words, rnd)
    if (wrong.length < 3) return null
    const opts = shuffle([clip(word.en), ...wrong], rnd)
    return {
      wordId: word.id,
      kind: k,
      prompt: k === 'cloze' ? 'Gapdagi bo‘sh joyga qaysi so‘z mos keladi?' : clip(word.uz, 150),
      sentence,
      options: opts,
      answer: opts.indexOf(clip(word.en)),
      explain,
    }
  }
  const wrong = distractors(word, 'uz', o.words, rnd)
  if (wrong.length < 3) return null
  const right = clip(word.uz)
  const opts = shuffle([right, ...wrong], rnd)
  return { wordId: word.id, kind: 'en2uz', prompt: word.en, options: opts, answer: opts.indexOf(right), explain }
}

/** Tasodifiy yo'nalish: en->uz 45%, uz->en 35%, gap ichida 20% (misol bo'lsa). */
export function pickKind(word: VocabWord, rnd: () => number = Math.random): QuizKind {
  const r = rnd()
  if (word.example && r < 0.2) return 'cloze'
  return r < 0.65 ? 'en2uz' : 'uz2en'
}

/* ------------------------------ sessiya tanlash ------------------------------ */

export type SessionMode = 'mix' | 'review' | 'weekly' | 'cat'

/**
 * Sessiya uchun so'zlar. mix: ~1/3 qismi takrorlanishi kerak so'zlardan (xatolar), qolgani yangi/tasodifiy;
 * review: faqat muddati kelgan xatolar; weekly: oxirgi 7 kunda xato qilingan so'zlar; cat: bitta bo'lim.
 */
export function pickSessionWords(
  words: readonly VocabWord[],
  progress: ReadonlyMap<number, VocabProgress>,
  mode: SessionMode,
  count: number,
  opts: { cat?: string; rnd?: () => number; now?: Date } = {},
): VocabWord[] {
  const rnd = opts.rnd ?? Math.random
  const now = opts.now ?? new Date()
  const pool = mode === 'cat' && opts.cat ? words.filter((w) => w.cat === opts.cat) : words.slice()
  const weak = (w: VocabWord) => {
    const p = progress.get(w.id)
    return !!p && (p.wrong_n > 0 && isDue(p, now))
  }
  if (mode === 'review') return shuffle(pool.filter(weak), rnd).slice(0, count)
  if (mode === 'weekly') {
    const w = pool.filter((x) => {
      const p = progress.get(x.id)
      return !!p && isWeeklyMistake(p, now)
    })
    return shuffle(w, rnd).slice(0, count)
  }
  const due = shuffle(pool.filter(weak), rnd).slice(0, Math.max(1, Math.round(count / 3)))
  const taken = new Set(due.map((w) => w.id))
  // qolganlari: hali ko'rilmagan so'zlar avval, keyin boshqalar
  const unseen = shuffle(pool.filter((w) => !taken.has(w.id) && !progress.has(w.id)), rnd)
  const seen = shuffle(pool.filter((w) => !taken.has(w.id) && progress.has(w.id) && (progress.get(w.id)?.box ?? 0) < BOX_MAX), rnd)
  const fill = [...unseen, ...seen].slice(0, Math.max(0, count - due.length))
  return shuffle([...due, ...fill], rnd)
}

export function buildQuiz(wordsAll: readonly VocabWord[], picked: readonly VocabWord[], rnd: () => number = Math.random): QuizQuestion[] {
  const uzCount = uzCounts(wordsAll)
  const out: QuizQuestion[] = []
  for (const w of picked) {
    const q = makeQuestion(w, pickKind(w, rnd), { words: wordsAll, uzCount, rnd })
    if (q) out.push(q)
  }
  return out
}

/** O'zlashtirilganlik: 3-qutidan yuqori. */
export function masteredCount(progress: Iterable<VocabProgress>): number {
  let n = 0
  for (const p of progress) if (p.box >= 3) n++
  return n
}
