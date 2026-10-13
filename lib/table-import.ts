import type { ChoiceId, Difficulty, Question } from '@/lib/test-data'

/**
 * Converts a pasted spreadsheet table (copied straight from Excel / Google
 * Sheets, or a .csv/.tsv file) into the site's Question[] JSON schema.
 *
 * This exists as a more reliable alternative to the LaTeX/Prism importer:
 * asking an AI to fill in a flat table with named columns is a task
 * general-purpose LLMs (ChatGPT, Gemini, Claude, ...) do very consistently,
 * whereas getting them to emit exact LaTeX command syntax is not. Answers
 * live in their own column, so there is no separate "Answer Key" section to
 * go missing.
 *
 * Expected columns (header row required, any order, Uzbek or English names
 * both work — see HEADER_ALIASES below):
 *   raqam | turi | savol | A | B | C | D | togri_javob | tushuntirish | qiyinchilik | rasm | formula
 *
 * - turi: "mcq" (default when blank) or "gridin" / "erkin javob"
 * - togri_javob: A/B/C/D for mcq, or the accepted numeric/text value for gridin
 * - formula: one or more LaTeX expressions separated by ";" -> Question.equations[]
 * - rasm: an image URL (upload the image first via the admin panel's image
 *   uploader, then paste the resulting URL here)
 *
 * Delimiter is auto-detected (tab if the header row contains one, else
 * comma), and both are parsed with basic RFC4180-style quote handling so a
 * cell can safely contain the other delimiter or a newline when quoted.
 */

export type TableImportWarning = { rowNumber: number; message: string }
export type TableImportResult = { questions: Question[]; warnings: TableImportWarning[] }

/* ------------------------------ delimited text ----------------------------- */

function detectDelimiter(headerLine: string): ',' | '\t' {
  return headerLine.includes('\t') ? '\t' : ','
}

/** RFC4180-ish parser: handles quoted fields containing the delimiter or newlines, and "" as an escaped quote. */
function parseDelimitedText(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  row.push(field)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  return rows
}

/* --------------------------------- headers --------------------------------- */

const HEADER_ALIASES: Record<string, string[]> = {
  number: ['raqam', 'no', '#', 'number', 'savol raqami'],
  type: ['turi', 'type', 'tur'],
  prompt: ['savol', 'savol matni', 'prompt', 'question', 'matn'],
  A: ['a', 'variant a', 'javob a', 'choice a'],
  B: ['b', 'variant b', 'javob b', 'choice b'],
  C: ['c', 'variant c', 'javob c', 'choice c'],
  D: ['d', 'variant d', 'javob d', 'choice d'],
  answer: ["to'g'ri_javob", "to'g'ri javob", 'togri_javob', 'togri javob', 'javob', 'answer', 'correct'],
  explanation: ['tushuntirish', 'explanation', 'izoh'],
  difficulty: ['qiyinchilik', 'difficulty'],
  image: ['rasm', 'image', 'rasm url', 'image url'],
  equation: ['formula', 'equation', 'tenglama', 'formulalar', 'formulas'],
}

function normalize(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/['’ʻ`]/g, '')
    .replace(/\s+/g, ' ')
}

function buildHeaderMap(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((raw, idx) => {
    const norm = normalize(raw)
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[key] !== undefined) continue
      if (aliases.some((a) => normalize(a) === norm)) {
        map[key] = idx
      }
    }
  })
  return map
}

/* ----------------------------------- main ---------------------------------- */

export function parseTableQuestions(source: string): TableImportResult {
  const warnings: TableImportWarning[] = []
  const trimmed = source.trim()
  if (!trimmed) return { questions: [], warnings: [] }

  const headerLine = trimmed.split(/\r?\n/, 1)[0]
  const delimiter = detectDelimiter(headerLine)
  const rows = parseDelimitedText(trimmed, delimiter).filter((r) => r.some((c) => c.trim() !== ''))

  if (rows.length < 2) {
    return {
      questions: [],
      warnings: [{ rowNumber: 0, message: "Sarlavha qatoridan tashqari hech qanday savol topilmadi." }],
    }
  }

  const headerMap = buildHeaderMap(rows[0])
  if (headerMap.prompt === undefined) {
    return {
      questions: [],
      warnings: [{ rowNumber: 0, message: '"savol" ustuni topilmadi — sarlavha qatorida shu nom borligini tekshiring.' }],
    }
  }
  if (headerMap.answer === undefined) {
    warnings.push({
      rowNumber: 0,
      message: '"to\'g\'ri_javob" ustuni topilmadi — barcha javoblarni pastdagi JSON\'da qo\'lda kiritishga to\'g\'ri keladi.',
    })
  }

  const questions: Question[] = []

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    const rowNumber = r + 1 // 1-based, counting the header row as row 1
    const get = (key: string): string => {
      const idx = headerMap[key]
      return idx === undefined ? '' : (cells[idx] ?? '').trim()
    }

    const prompt = get('prompt')
    if (!prompt) {
      warnings.push({ rowNumber, message: `${rowNumber}-qator: savol matni bo'sh — o'tkazib yuborildi.` })
      continue
    }

    const typeNorm = normalize(get('type'))
    const isGridin = /grid|erkin|produced/.test(typeNorm)

    const difficultyNorm = normalize(get('difficulty'))
    let difficulty: Difficulty | undefined
    if (/easy|oson/.test(difficultyNorm)) difficulty = 'Easy'
    else if (/hard|qiyin/.test(difficultyNorm)) difficulty = 'Hard'
    else if (/medium|o'rta|orta/.test(difficultyNorm)) difficulty = 'Medium'

    const image = get('image') || undefined
    const equationRaw = get('equation')
    const equations = equationRaw
      ? equationRaw.split(';').map((e) => e.trim()).filter(Boolean)
      : undefined
    const explanation = get('explanation') || undefined
    const answerRaw = get('answer')

    if (isGridin) {
      if (!answerRaw) {
        warnings.push({ rowNumber, message: `${rowNumber}-qator (gridin savol): to'g'ri javob kiritilmagan.` })
      }
      questions.push({
        type: 'gridin',
        prompt,
        difficulty,
        image,
        equations,
        explanation,
        correctValue: answerRaw || undefined,
      })
      continue
    }

    const choiceLetters: ChoiceId[] = ['A', 'B', 'C', 'D']
    const choices = choiceLetters
      .map((letter) => {
        const text = get(letter)
        if (!text) return null
        const hasMath = /\\(dfrac|frac|sqrt|cdot|circ|left|right|pi|times)/.test(text) || /\$/.test(text)
        return hasMath ? { id: letter, tex: text.replace(/\$/g, '').trim() } : { id: letter, text }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)

    if (choices.length < 2) {
      warnings.push({ rowNumber, message: `${rowNumber}-qator: kamida 2 ta javob varianti (A/B/C/D ustunlari) kerak.` })
    }

    const correctLetter = answerRaw.toUpperCase().trim() as ChoiceId
    const correctIsValid = (['A', 'B', 'C', 'D'] as string[]).includes(correctLetter)
    if (!answerRaw) {
      warnings.push({ rowNumber, message: `${rowNumber}-qator: to'g'ri javob (A/B/C/D) kiritilmagan.` })
    } else if (!correctIsValid) {
      warnings.push({ rowNumber, message: `${rowNumber}-qator: to'g'ri javob "${answerRaw}" — A/B/C/D dan biri bo'lishi kerak.` })
    }

    questions.push({
      type: 'mcq',
      prompt,
      difficulty,
      image,
      equations,
      explanation,
      choices: choices.length ? choices : undefined,
      correct: correctIsValid ? correctLetter : undefined,
    })
  }

  return { questions, warnings }
}

/** A ready-to-download CSV template with headers and two original (non-copyrighted) example rows. */
export const TABLE_TEMPLATE_CSV = `raqam,turi,savol,A,B,C,D,to'g'ri_javob,tushuntirish,qiyinchilik,rasm,formula
1,mcq,"Agar 3x + 7 = 22 bo'lsa, x ning qiymati nechiga teng?",3,5,7,15,B,"3x = 15, demak x = 5.",Easy,,3x + 7 = 22
2,gridin,"Bir dukondagi narx 40000 so'mdan 25% ga oshirilsa, yangi narx qancha bo'ladi?",,,,,50000,"40000 * 1.25 = 50000.",Medium,,
`
