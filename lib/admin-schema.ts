import type { Question, ChoiceId, TestModule, SectionKind } from '@/lib/test-data'

export type ValidationError = { index: number; message: string }

const VALID_CHOICE_IDS: ChoiceId[] = ['A', 'B', 'C', 'D']

/**
 * Validates a raw parsed value as an array of Question objects.
 * Returns a list of human-readable errors (in Uzbek) with the question index.
 * Does not throw — the caller decides what to do with an empty vs non-empty result.
 *
 * By default (requireAnswers: true) a missing "correct"/"correctValue" is a
 * hard error, same as before. Pass requireAnswers: false to allow saving
 * questions with no answer key yet — used by the module importer, since the
 * admin panel's "Javob kiritish" (answer-entry) mode is meant to fill those
 * in afterward by clicking through them, without ever touching JSON again.
 * A provided answer is still checked for validity either way (must be a
 * real A/B/C/D that matches one of the choices).
 */
export function validateQuestions(raw: unknown, opts?: { requireAnswers?: boolean }): ValidationError[] {
  const requireAnswers = opts?.requireAnswers ?? true
  const errors: ValidationError[] = []

  if (!Array.isArray(raw)) {
    return [{ index: -1, message: "Fayl mazmuni savollar ro'yxati (JSON array) bo'lishi kerak." }]
  }

  raw.forEach((q, i) => {
    const n = i + 1
    if (typeof q !== 'object' || q === null) {
      errors.push({ index: i, message: `${n}-savol: obyekt emas.` })
      return
    }
    const question = q as Partial<Question>

    if (!question.prompt || typeof question.prompt !== 'string') {
      errors.push({ index: i, message: `${n}-savol: "prompt" (savol matni) kiritilmagan.` })
    }

    const type = question.type ?? 'mcq'

    if (type === 'mcq') {
      if (!Array.isArray(question.choices) || question.choices.length < 2) {
        errors.push({ index: i, message: `${n}-savol: kamida 2 ta "choices" (javob varianti) kerak.` })
      } else {
        question.choices.forEach((c, ci) => {
          if (!c || !VALID_CHOICE_IDS.includes(c.id as ChoiceId)) {
            errors.push({ index: i, message: `${n}-savol, ${ci + 1}-variant: "id" A/B/C/D dan biri bo'lishi kerak.` })
          }
          if (!c?.text && !c?.tex && !c?.image) {
            errors.push({ index: i, message: `${n}-savol, ${ci + 1}-variant: "text", "tex" yoki "image" (rasm) yo'q — javob faqat rasm bo'lsa, rasmni yuklang.` })
          }
        })
      }
      const correctRaw = question.correct as unknown
      const hasAnswer = correctRaw !== undefined && correctRaw !== null && correctRaw !== ''
      if (hasAnswer) {
        if (!VALID_CHOICE_IDS.includes(question.correct as ChoiceId)) {
          errors.push({ index: i, message: `${n}-savol: "correct" (to'g'ri javob) A/B/C/D dan biri bo'lishi kerak.` })
        } else if (
          Array.isArray(question.choices) &&
          !question.choices.some((c) => c?.id === question.correct)
        ) {
          errors.push({ index: i, message: `${n}-savol: "correct" qiymati "choices" ichida topilmadi.` })
        }
      } else if (requireAnswers) {
        errors.push({ index: i, message: `${n}-savol: "correct" (to'g'ri javob) A/B/C/D dan biri bo'lishi kerak.` })
      }
    } else if (type === 'gridin') {
      const hasAnswer = typeof question.correctValue === 'string' && question.correctValue.trim() !== ''
      if (!hasAnswer && requireAnswers) {
        errors.push({ index: i, message: `${n}-savol: gridin turi uchun "correctValue" kerak.` })
      }
    } else {
      errors.push({ index: i, message: `${n}-savol: "type" faqat "mcq" yoki "gridin" bo'lishi mumkin.` })
    }
  })

  return errors
}

/** Number of questions in a valid array that still have no answer key set — used to
 *  show a "N ta savolda javob yo'q, keyin to'ldirasiz" hint after a requireAnswers:false save. */
export function countUnanswered(questions: Question[]): number {
  return questions.filter((q) =>
    (q.type ?? 'mcq') === 'gridin' ? !q.correctValue?.trim() : !q.correct,
  ).length
}

export const SAMPLE_QUESTIONS: Question[] = [
  {
    type: 'mcq',
    difficulty: 'Medium',
    domain: 'Craft and Structure',
    passage:
      "O'zbekistonda paxtachilik tarixi uzoq davrga borib taqaladi. Ayrim tadqiqotchilar buni mintaqaning asosiy iqtisodiy tarmog'i deb hisoblashadi.",
    underline: "Ayrim tadqiqotchilar buni mintaqaning asosiy iqtisodiy tarmog'i deb hisoblashadi.",
    prompt: 'Berilgan gapda muallifning maqsadi nima?',
    choices: [
      { id: 'A', text: "Paxtachilikning tarixiy ahamiyatini ta'kidlash" },
      { id: 'B', text: "Boshqa tarmoqlar bilan taqqoslash" },
      { id: 'C', text: 'Statistik ma\u02bblumot keltirish' },
      { id: 'D', text: 'Qarama-qarshi fikrni rad etish' },
    ],
    correct: 'A',
    explanation: "Gap paxtachilikning mintaqa iqtisodiyotidagi tarixiy o'rnini ta'kidlaydi.",
  },
  {
    type: 'gridin',
    difficulty: 'Easy',
    domain: 'Algebra',
    prompt: 'Agar 2x + 5 = 17 bo\u02bblsa, x ning qiymati nechiga teng?',
    equations: ['2x + 5 = 17'],
    correctValue: '6',
    explanation: '2x = 12, demak x = 6.',
  },
]

/** Generates a formatted, ready-to-paste TypeScript module definition. */
export function generateModuleCode(opts: {
  varName: string
  id: string
  kind: SectionKind
  label: string
  shortLabel: string
  durationMinutes: number
  total: number
  questions: Question[]
}): string {
  const mod: TestModule = {
    id: opts.id,
    kind: opts.kind,
    label: opts.label,
    shortLabel: opts.shortLabel,
    durationSec: opts.durationMinutes * 60,
    total: opts.total,
    pool: opts.questions,
  }

  const body = JSON.stringify(mod, null, 2)
    // JSON.stringify quotes every key; TS doesn't require that, but valid TS
    // still accepts quoted keys, so we leave it — safe and always valid.
    .replace(/^{/, '{')

  return `// ODATDA ENG YAXSHI YO'L: shu massivning ICHIDAGI savol obyektlarini
// (tashqi [ ] qavslarsiz) lib/test-data.ts faylidagi mavjud "mathPool" yoki
// "readingPool" massivi ICHIGA qo'shing — bu xavfsiz va MODULES tuzilishini
// buzmaydi, chunki mavjud modullar shu pool'lardan aylanma tarzda foydalanadi.
//
// Faqat AGAR haqiqatan yangi, alohida modul (masalan butunlay yangi Practice
// Test) yaratayotgan bo'lsangiz va buni MODULES massiviga qanday ulashni
// bilsangiz, quyidagi kod shu uchun tayyorlandi:
export const ${opts.varName}: TestModule = ${body}`
}
