/**
 * Mualliflik kitoblari katalogi — landing, dashboard va yuklab olish API'si shu yerdan o'qiydi.
 *
 * Yangi kitob qo'shish:
 *  1. Muqova va dastlabki sahifalarni public/books/<slug>/ papkasiga qo'ying (cover.webp, cover-sm.webp, preview-1..N.webp).
 *  2. To'liq PDF'ni Supabase Storage → "books" bucket'iga yuklang (fayl nomi `file` maydoniga mos bo'lsin).
 *  3. Pastdagi BOOKS ro'yxatiga yangi obyekt qo'shing (status: 'available'). "soon" kartochkasini olib tashlang.
 *
 * To'liq PDF hech qachon public/ ichida turmaydi — faqat yopiq bucket'da, yuklab olish esa
 * tizimga kirgan foydalanuvchiga qisqa muddatli havola orqali beriladi (app/api/books/download).
 */

export const BOOKS_BUCKET = 'books'

export type BookTopic = { n: number; name: string; page: number }
export type BookDomain = { name: string; tone: string; topics: BookTopic[] }

export type AvailableBook = {
  slug: string
  status: 'available'
  title: string
  subtitle: string
  author: string
  /** Taxminiy sahifalar soni (landing'da "290+" ko'rinishida). */
  pagesLabel: string
  domains: number
  topics: number
  /** Taxminiy fayl hajmi (faqat ko'rsatish uchun). */
  sizeLabel: string
  cover: string
  coverSm: string
  back: string
  previews: string[]
  /** Yopiq `books` bucket ichidagi fayl yo'li. */
  file: string
  /** Foydalanuvchi yuklab olganda ko'radigan fayl nomi. */
  downloadName: string
  toc: BookDomain[]
}

export type SoonBook = { slug: string; status: 'soon' }
export type Book = AvailableBook | SoonBook

export const SAT_SQB: AvailableBook = {
  slug: 'sat-sqb',
  status: 'available',
  title: 'SAT SQB Savollari',
  subtitle: 'SAT Math · 4 ta domen · 19 ta mavzu',
  author: 'Usmon Xamroyev',
  pagesLabel: '290+',
  domains: 4,
  topics: 19,
  sizeLabel: 'PDF · ≈3 MB',
  cover: '/books/sat-sqb/cover.webp',
  coverSm: '/books/sat-sqb/cover-sm.webp',
  back: '/books/sat-sqb/back.webp',
  previews: [1, 2, 3, 4, 5, 6].map((i) => `/books/sat-sqb/preview-${i}.webp`),
  file: 'sat-sqb.pdf',
  downloadName: 'SAT SQB Savollari - Usmon Xamroyev - satbyusmon.com.pdf',
  toc: [
    {
      name: 'Algebra',
      tone: '#2a8a9a',
      topics: [
        { n: 1, name: 'Linear Equations in One Variable', page: 1 },
        { n: 2, name: 'Linear Functions', page: 13 },
        { n: 3, name: 'Linear Equations in Two Variables', page: 39 },
        { n: 4, name: 'Systems of Two Linear Equations', page: 59 },
        { n: 5, name: 'Linear Inequalities', page: 79 },
      ],
    },
    {
      name: 'Advanced Math',
      tone: '#5b63b7',
      topics: [
        { n: 6, name: 'Equivalent Expressions', page: 93 },
        { n: 7, name: 'Nonlinear Equations', page: 103 },
        { n: 8, name: 'Nonlinear Functions', page: 124 },
      ],
    },
    {
      name: 'Problem-Solving and Data Analysis',
      tone: '#e07b3c',
      topics: [
        { n: 9, name: 'Ratios, Rates, Proportional Relationships, and Units', page: 164 },
        { n: 10, name: 'Percentages', page: 174 },
        { n: 11, name: 'One-Variable Data', page: 183 },
        { n: 12, name: 'Two-Variable Data', page: 199 },
        { n: 13, name: 'Probability and Conditional Probability', page: 218 },
        { n: 14, name: 'Inference from Sample Statistics', page: 225 },
        { n: 15, name: 'Evaluating Statistical Claims', page: 230 },
      ],
    },
    {
      name: 'Geometry and Trigonometry',
      tone: '#3a9a72',
      topics: [
        { n: 16, name: 'Lines, Angles, and Triangles', page: 233 },
        { n: 17, name: 'Right Triangle and Trigonometry', page: 249 },
        { n: 18, name: 'Circles', page: 258 },
        { n: 19, name: 'Area and Volume', page: 266 },
      ],
    },
  ],
}

/** Katalog tartibi: yangi kitob shu ro'yxatga qo'shiladi. Oxirgi "soon" — ikkinchi kitob uchun joy. */
export const BOOKS: Book[] = [SAT_SQB, { slug: 'second-book', status: 'soon' }]

export function getAvailableBook(slug: string | null | undefined): AvailableBook | null {
  const b = BOOKS.find((x) => x.slug === slug)
  return b && b.status === 'available' ? b : null
}

/** Landing / sahifalardan ro'yxatdan o'tib, keyin kitoblar bo'limiga qaytish manzili. */
export const BOOKS_SIGNUP_URL = '/login?mode=signup&next=%2Fdashboard%2Fbooks'
export const BOOKS_SIGNIN_URL = '/login?next=%2Fdashboard%2Fbooks'
