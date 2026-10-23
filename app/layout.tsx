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

const SITE = 'https://satbyusmon.com'
const DESCRIPTION =
  "SAT Akademiyasi — O'zbekistonda Digital SAT'ga tayyorlanish platformasi: bepul SAT mock testlar, SAT Math va Reading & Writing mashqlari, o'tgan imtihonlar, savollar banki, video tahlillar va o'zbek tilidagi kurslar."

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "SAT Akademiyasi — Digital SAT mock testlar va kurslar | satbyusmon.com",
    template: '%s | SAT Akademiyasi',
  },
  description: DESCRIPTION,
  applicationName: 'SAT Akademiyasi',
  authors: [{ name: 'Usmon Xamroyev', url: 'https://t.me/Usmon_Xamroyev' }],
  creator: 'SAT Akademiyasi',
  publisher: 'SAT Akademiyasi',
  // Google mostly ignores this list, other engines (Yandex, Bing) still read it. The common ways people
  // misspell the site and the brand are here so a typo still finds us.
  keywords: [
    'SAT', 'Digital SAT', 'SAT mock test', 'SAT mock', 'bepul SAT mock', 'SAT test online', 'SAT tayyorgarlik',
    "SAT ga tayyorlanish", 'SAT kurslari', 'SAT Math', 'SAT Reading and Writing', 'SAT practice test', 'SAT past exams',
    'SAT Uzbekistan', "SAT O'zbekiston", 'SAT Toshkent', 'SAT Termiz', 'SAT Surxondaryo', 'Bluebook SAT', 'SAT Akademiyasi',
    'SAT Akademiya', 'SAT Academy Uzbekistan', 'SAT by Usmon', 'satbyusmon', 'sat by usmon', 'satbyusmon.com', 'sat byusmon',
    'satbyusman', 'sat by usman', 'sat bayusmon', 'satbaiusmon', 'Usmon Xamroyev', 'Usmon Xamroev', 'SAT 1600', 'SAT 800 math',
    'подготовка к SAT', 'SAT Узбекистан', 'пробный тест SAT',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: 'SAT Akademiyasi',
    title: "SAT Akademiyasi — Digital SAT'ga o'zbek tilida tayyorgarlik",
    description: "Haqiqiy imtihondagidek SAT mock testlar, savollar banki, natijalar tahlili va Telegram kurslari. Bepul boshlang.",
    locale: 'uz_UZ',
    alternateLocale: ['ru_RU', 'en_US'],
    images: [{ url: '/og.png', width: 1200, height: 630, alt: "SAT Akademiyasi — Digital SAT mock testlar va kurslar" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "SAT Akademiyasi — Digital SAT'ga o'zbek tilida tayyorgarlik",
    description: "Haqiqiy imtihondagidek SAT mock testlar, savollar banki, natijalar tahlili va Telegram kurslari.",
    images: ['/og.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  category: 'education',
  // Paste the code from Google Search Console here (Vercel env NEXT_PUBLIC_GOOGLE_VERIFICATION) to verify the site.
  verification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION } : undefined,
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
