import type { ChoiceId, Question } from '@/lib/test-data'

/**
 * Converts a Prism-style LaTeX question booklet into the site's Question[]
 * JSON schema. Two source formats are recognized and auto-detected:
 *
 * Format A — numbered-command style:
 *   \q{<number>}{<type label, e.g. "Student-produced response">}
 *   \choices{A}{B}{C}{D}
 *   \response                (marks a grid-in / student-produced question)
 *   \finishq
 *   \module{<label>}         (section header; an "Answer Key" module is
 *                             parsed separately to auto-fill correct answers)
 *
 * Format B — Prism's `question` environment style:
 *   \begin{question}{<opaque id>}
 *   ...prompt text...
 *   \choices{A}{B}{C}{D}
 *   \workspace                (blank scratch-work area; questions with no
 *                             \choices are treated as grid-in)
 *   \end{question}
 *
 * Both formats share:
 *   \[ ... \]                (display equation -> Question.equations[])
 *   \begin{tikzpicture}...\end{tikzpicture}  (figure -> flagged, not rendered)
 *   \begin{tabular}...\end{tabular}          (data table -> flattened to text)
 *
 * Decorative commands (tcolorbox, minipage, center, fancyhdr, geometry, …)
 * are stripped; only question number/id, prompt text, choice text/expressions,
 * equations, and grid-in markers survive.
 */

export type LatexImportWarning = {
  questionNumber: number | null
  message: string
}

export type LatexImportResult = {
  questions: Question[]
  warnings: LatexImportWarning[]
}

/* --------------------------- small text helpers -------------------------- */

function stripLatexNoise(s: string): string {
  return s
    .replace(/\\newpage/g, ' ')
    .replace(/\\par\b/g, ' ')
    .replace(/\\notscale/g, ' ')
    .replace(/\\vfill/g, ' ')
    .replace(/\\hfill/g, ' ')
    .replace(/\\vspace\{[^}]*\}/g, ' ')
    .replace(/\\enspace/g, ' ')
    .replace(/\\quad/g, ' ')
    .replace(/\\(centering|raggedright|raggedleft|bfseries|sffamily|small|scriptsize|normalfont)\b/g, ' ')
    .replace(/\\color\{[^}]*\}/g, ' ')
    .replace(/\{,\}/g, ',') // LaTeX thousands separator: 1{,}200 -> 1,200
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\$([^$]*)\$/g, '$1') // inline math: keep the LaTeX source as plain text
    .trim()
}

/** Strips a \begin{env}[...]{...}...\end{env} wrapper, keeping inner content. */
function unwrapEnvironments(s: string, envs: string[]): string {
  let out = s
  for (const env of envs) {
    const beginRe = new RegExp(`\\\\begin\\{${env}\\}(?:\\[[^\\]]*\\])?(?:\\{[^}]*\\})?`, 'g')
    const endRe = new RegExp(`\\\\end\\{${env}\\}`, 'g')
    out = out.replace(beginRe, ' ').replace(endRe, ' ')
  }
  return out
}

/** Removes tikzpicture blocks entirely, returning [cleaned, hadFigure]. */
function extractAndDropFigures(s: string): { cleaned: string; hadFigure: boolean } {
  const re = /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g
  let hadFigure = false
  const cleaned = s.replace(re, () => {
    hadFigure = true
    return ' '
  })
  return { cleaned, hadFigure }
}

/** Pulls out \[ ... \] display-math blocks into a list, removing them from the source. */
function extractDisplayEquations(s: string): { cleaned: string; equations: string[] } {
  const equations: string[] = []
  const cleaned = s.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => {
    const eq = inner.trim()
    if (eq) equations.push(eq)
    return ' '
  })
  return { cleaned, equations }
}

/** Flattens a \begin{tabular}...\end{tabular} into plain "col | col" text lines. */
function flattenTables(s: string): { cleaned: string; hadTable: boolean } {
  let hadTable = false
  const cleaned = s.replace(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g, (_m, body) => {
    hadTable = true
    const rows = body
      .split('\\\\')
      .map((row: string) =>
        row
          .replace(/\\toprule|\\midrule|\\bottomrule|\\hline/g, '')
          .trim(),
      )
      .filter((row: string) => row.length > 0)
      .map((row: string) =>
        row
          .split('&')
          .map((cell: string) => stripLatexNoise(cell).trim())
          .join(' | '),
      )
    return '\n' + rows.join('\n') + '\n'
  })
  return { cleaned, hadTable }
}

/** Splits `\choices{a}{b}{c}{d}` into its 4 brace-delimited arguments (handles nested braces). */
function splitBraceArgs(s: string, count: number): string[] | null {
  const args: string[] = []
  let i = 0
  for (let n = 0; n < count; n++) {
    while (s[i] === ' ') i++
    if (s[i] !== '{') return null
    let depth = 0
    let start = i
    for (; i < s.length; i++) {
      if (s[i] === '{') depth++
      else if (s[i] === '}') {
        depth--
        if (depth === 0) {
          i++
          break
        }
      }
    }
    args.push(s.slice(start + 1, i - 1))
  }
  return args
}

function cleanChoiceText(raw: string): { text?: string; tex?: string } {
  const trimmed = raw.trim()
  const hasMath = /\$/.test(trimmed) || /\\(dfrac|frac|sqrt|cdot|circ|left|right|pi|times)/.test(trimmed)
  const withoutDollars = trimmed.replace(/\$/g, '').trim()
  const cleaned = stripLatexNoise(withoutDollars)
  return hasMath ? { tex: cleaned } : { text: cleaned }
}

/* -------------------------------- answer key ------------------------------ */

/** Parses an "Answer Key" style tabular section into a map of question number -> answer string. */
function parseAnswerKey(fullTex: string): Map<number, string> {
  const map = new Map<number, string>()
  const moduleMatch = /\\module\{\s*Answer\s*Key\s*\}([\s\S]*?)(?:\\end\{document\}|$)/i.exec(fullTex)
  if (!moduleMatch) return map
  const section = moduleMatch[1]
  const tableMatch = /\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/.exec(section)
  if (!tableMatch) return map

  const rows = tableMatch[1].split('\\\\')
  for (const row of rows) {
    const cleanedRow = row.replace(/\\toprule|\\midrule|\\bottomrule|\\hline/g, '').trim()
    if (!cleanedRow) continue
    const cells = cleanedRow.split('&').map((c) => stripLatexNoise(c).replace(/\$/g, '').trim())
    // Cells come in (Question, Answer) pairs, possibly several pairs per row.
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const num = Number(cells[i])
      const ans = cells[i + 1]
      if (Number.isFinite(num) && ans) map.set(num, ans)
    }
  }
  return map
}

/* ----------------------------- block extraction ---------------------------- */

type RawBlock = {
  /** Sequential position (1-based) used for display when no real number exists. */
  displayNumber: number
  /** The question's own number/id as found in the source, if any (for answer-key matching). */
  sourceNumber: number | null
  /** Free-form id string (e.g. Prism's opaque hash) shown in warnings. */
  sourceId: string | null
  body: string
  /** True if the source explicitly marked this as a grid-in / free-response question. */
  forcedGridin: boolean
}

/** Format A: `\q{<number>}{<type label>} ... \finishq` */
function extractFormatABlocks(body: string): RawBlock[] {
  const chunks = body.split(/(?=\\q\{)/g).filter((c) => c.trim().startsWith('\\q{'))
  const blocks: RawBlock[] = []
  let seq = 0
  for (const chunk of chunks) {
    const afterCmd = chunk.slice(chunk.indexOf('\\q{') + 3)
    const args = splitBraceArgs('{' + afterCmd, 2)
    if (!args) continue
    const [numStr, typeLabel] = args
    const number = Number(numStr.trim())
    const qStart = chunk.indexOf('}{')
    let rest = qStart === -1 ? '' : chunk.slice(chunk.indexOf('}', qStart + 2) + 1)
    rest = rest.split('\\finishq')[0]
    seq++
    blocks.push({
      displayNumber: seq,
      sourceNumber: Number.isFinite(number) ? number : null,
      sourceId: numStr.trim(),
      body: rest,
      forcedGridin: /\\response\b/.test(rest) || /student-produced/i.test(typeLabel),
    })
  }
  return blocks
}

/** Format B: `\begin{question}{<id>} ... \end{question}`, with `\workspace` marking grid-in. */
function extractFormatBBlocks(body: string): RawBlock[] {
  const blocks: RawBlock[] = []
  const re = /\\begin\{question\}\{([^}]*)\}([\s\S]*?)\\end\{question\}/g
  let match: RegExpExecArray | null
  let seq = 0
  while ((match = re.exec(body))) {
    const [, id, inner] = match
    seq++
    const numericId = Number(id.trim())
    blocks.push({
      displayNumber: seq,
      sourceNumber: Number.isFinite(numericId) && /^\d+$/.test(id.trim()) ? numericId : null,
      sourceId: id.trim() || null,
      body: inner,
      forcedGridin: /\\workspace\b/.test(inner) && !/\\choices\{/.test(inner),
    })
  }
  return blocks
}

function extractBlocks(body: string): RawBlock[] {
  if (/\\begin\{question\}\{/.test(body)) return extractFormatBBlocks(body)
  return extractFormatABlocks(body)
}

/* --------------------------------- main API -------------------------------- */

export function parseLatexQuestions(source: string): LatexImportResult {
  const warnings: LatexImportWarning[] = []
  const answerKey = parseAnswerKey(source)

  // Work only within \begin{document}...\end{document} if present.
  const docMatch = /\\begin\{document\}([\s\S]*?)\\end\{document\}/.exec(source)
  let body = docMatch ? docMatch[1] : source

  // Drop the Answer Key module itself so its table isn't mistaken for a question.
  body = body.replace(/\\module\{\s*Answer\s*Key\s*\}[\s\S]*$/i, '')

  const blocks = extractBlocks(body)
  const questions: Question[] = []

  for (const block of blocks) {
    const label = block.sourceId && block.sourceId !== String(block.sourceNumber)
      ? `${block.displayNumber}-savol (id: ${block.sourceId})`
      : `${block.displayNumber}-savol`
    const isGridin = block.forcedGridin
    let rest = block.body

    // Figures
    const { cleaned: noFig, hadFigure } = extractAndDropFigures(rest)
    if (hadFigure) {
      warnings.push({
        questionNumber: block.sourceNumber,
        message: `${label}da chizma (figure) aniqlandi — avtomatik chizilmaydi. "image" maydoniga rasm URL'ini qo'lda qo'shing.`,
      })
    }

    // Tables
    const { cleaned: noTable, hadTable } = flattenTables(noFig)
    if (hadTable) {
      warnings.push({
        questionNumber: block.sourceNumber,
        message: `${label}dagi jadval matnga aylantirildi — matnni tekshirib chiqing.`,
      })
    }

    // Display equations
    const { cleaned: noEq, equations } = extractDisplayEquations(noTable)

    // Choices
    let choices: Question['choices'] | undefined
    let withoutChoices = noEq
    const choicesMatch = /\\choices((?:\{[^{}]*\})+)/.exec(noEq)
    if (choicesMatch && !isGridin) {
      const choiceArgs = splitBraceArgs(choicesMatch[1], 4)
      if (choiceArgs) {
        const ids: ChoiceId[] = ['A', 'B', 'C', 'D']
        choices = choiceArgs.map((c, i) => ({ id: ids[i], ...cleanChoiceText(c) }))
      }
      withoutChoices = noEq.replace(choicesMatch[0], ' ')
    } else if (choicesMatch) {
      // Gridin question that still had a stray \choices block (shouldn't
      // normally happen) — strip it so it doesn't leak into the prompt.
      withoutChoices = noEq.replace(choicesMatch[0], ' ')
    }

    // Strip decorative wrappers and \response/\workspace, leaving plain prompt text.
    let promptRaw = withoutChoices.replace(/\\response\b/g, ' ').replace(/\\workspace\b/g, ' ')
    promptRaw = unwrapEnvironments(promptRaw, ['minipage', 'center', 'tabular'])
    const prompt = stripLatexNoise(promptRaw).replace(/\s+/g, ' ').trim()

    if (!prompt) {
      warnings.push({
        questionNumber: block.sourceNumber,
        message: `${label}ning matni bo'sh chiqdi — qo'lda tekshiring.`,
      })
    }

    const answer = block.sourceNumber != null ? answerKey.get(block.sourceNumber) : undefined
    if (!answer) {
      warnings.push({
        questionNumber: block.sourceNumber,
        message: `${label} uchun javoblar kaliti (Answer Key) topilmadi — "correct"/"correctValue"ni qo'lda kiriting.`,
      })
    }

    const question: Question = isGridin
      ? { type: 'gridin', prompt, equations: equations.length ? equations : undefined, correctValue: answer }
      : {
          type: 'mcq',
          prompt,
          equations: equations.length ? equations : undefined,
          choices,
          correct: answer as ChoiceId | undefined,
        }

    questions.push(question)
  }

  return { questions, warnings }
}
