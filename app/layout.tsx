import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
import 'katex/dist/katex.min.css'
import './globals.css'
import { SiteGuards } from '@/components/site-guards'
import { VisitPing } from '@/components/visit-ping'
import { cookies } from 'next/headers'
import { I18nProvider } from '@/components/i18n-provider'
import { LANG_COOKIE, isLang, type Lang } from '@/lib/i18n'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
})

// Used for display headings on the landing page and dashboard only —
// the exam engine itself keeps Inter throughout for consistency with Bluebook.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
})

// SAT Pro redesign (2026-09): landing, login, and dashboard use Plus Jakarta
// Sans exclusively. The exam engine is untouched and keeps Inter.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
})

export const metadata: Metadata = {
  title: 'Digital SAT Prep — Practice Test',
  description:
    'A modern Digital SAT practice test interface inspired by Bluebook and Greenbook, with LaTeX equation rendering, a timer, and a calculator.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0f172a',
}

// Runs before paint so the SAT Pro pages (landing/login/dashboard) never
// flash the wrong theme. Reads the saved preference; defaults to dark,
// matching the design brief. Exam pages ignore this attribute entirely.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem('sp-theme');
    // The dashboard design is light by default; everything else defaults to dark.
    var theme = saved === 'light' || saved === 'dark' ? saved : (location.pathname.indexOf('/dashboard') === 0 ? 'light' : 'dark');
    document.documentElement.setAttribute('data-sp-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-sp-theme', 'dark');
  }
})();
`

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value
  const lang: Lang = isLang(cookieLang) ? cookieLang : 'uz'
  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${jakarta.variable} bg-background`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <I18nProvider initial={lang}>{children}</I18nProvider>
        <SiteGuards />
        <VisitPing />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
