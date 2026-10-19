import type { Lang } from '@/lib/i18n'

/** The four book sections as students see them (URL key ↔ database `domain`) with names in each language. */
export const BANK_SECTIONS = [
  { key: 'algebra', domain: 'Algebra', hue: 24, names: { uz: 'Algebra', ru: 'Алгебра', en: 'Algebra' } },
  { key: 'advanced-math', domain: 'Advanced Math', hue: 262, names: { uz: 'Advanced Math', ru: 'Продвинутая математика', en: 'Advanced Math' } },
  {
    key: 'problem-solving-data-analysis',
    domain: 'Problem-Solving and Data Analysis',
    hue: 160,
    names: { uz: 'Problem-Solving and Data Analysis', ru: 'Решение задач и анализ данных', en: 'Problem-Solving and Data Analysis' },
  },
  { key: 'geometry-trigonometry', domain: 'Geometry and Trigonometry', hue: 205, names: { uz: 'Geometry and Trigonometry', ru: 'Геометрия и тригонометрия', en: 'Geometry and Trigonometry' } },
] as const

export type BankSectionKey = (typeof BANK_SECTIONS)[number]['key']
export const sectionByKey = (k: string) => BANK_SECTIONS.find((s) => s.key === k)

const TOPICS: Record<string, Record<Lang, string>> = {
  LE1: { en: 'Linear Equations in One Variable', ru: 'Линейные уравнения с одной переменной', uz: 'Bir o‘zgaruvchili chiziqli tenglamalar' },
  LF: { en: 'Linear Functions', ru: 'Линейные функции', uz: 'Chiziqli funksiyalar' },
  LE2: { en: 'Linear Equations in Two Variables', ru: 'Линейные уравнения с двумя переменными', uz: 'Ikki o‘zgaruvchili chiziqli tenglamalar' },
  SYS: { en: 'Systems of Two Linear Equations', ru: 'Системы двух линейных уравнений', uz: 'Ikkita chiziqli tenglama sistemasi' },
  INEQ: { en: 'Linear Inequalities', ru: 'Линейные неравенства', uz: 'Chiziqli tengsizliklar' },
  Equivalent: { en: 'Equivalent Expressions', ru: 'Равносильные выражения', uz: 'Teng kuchli ifodalar' },
  NLE: { en: 'Nonlinear Equations', ru: 'Нелинейные уравнения', uz: 'Chiziqli bo‘lmagan tenglamalar' },
  NLF: { en: 'Nonlinear Functions', ru: 'Нелинейные функции', uz: 'Chiziqli bo‘lmagan funksiyalar' },
  RATIO: { en: 'Ratios, Rates, Proportional Relationships, and Units', ru: 'Отношения, скорости, пропорции и единицы измерения', uz: 'Nisbat, tezlik, proporsiya va birliklar' },
  PCT: { en: 'Percentages', ru: 'Проценты', uz: 'Foizlar' },
  ONEVAR: { en: 'One-Variable Data', ru: 'Данные с одной переменной', uz: 'Bir o‘zgaruvchili ma’lumotlar' },
  TWOVAR: { en: 'Two-Variable Data', ru: 'Данные с двумя переменными', uz: 'Ikki o‘zgaruvchili ma’lumotlar' },
  PROB: { en: 'Probability and Conditional Probability', ru: 'Вероятность и условная вероятность', uz: 'Ehtimollik va shartli ehtimollik' },
  INF: { en: 'Inference from Sample Statistics', ru: 'Выводы по выборочной статистике', uz: 'Tanlanma statistikadan xulosa chiqarish' },
  EVAL: { en: 'Evaluating Statistical Claims', ru: 'Оценка статистических утверждений', uz: 'Statistik da’volarni baholash' },
  AREA: { en: 'Area and Volume', ru: 'Площадь и объём', uz: 'Yuza va hajm' },
  LINES: { en: 'Lines, Angles, and Triangles', ru: 'Прямые, углы и треугольники', uz: 'To‘g‘ri chiziqlar, burchaklar va uchburchaklar' },
  RIGHT: { en: 'Right Triangle and Trigonometry', ru: 'Прямоугольный треугольник и тригонометрия', uz: 'To‘g‘ri burchakli uchburchak va trigonometriya' },
  CIRC: { en: 'Circles', ru: 'Окружности', uz: 'Aylanalar' },
}

/** Topic name in the student's language (falls back to the English name stored in the bank). */
export const topicName = (code: string, fallback: string, lang: Lang) => TOPICS[code]?.[lang] ?? fallback
