import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kirish va ro‘yxatdan o‘tish',
  description: "SAT Akademiyasi'ga kiring yoki bepul ro'yxatdan o'ting: Digital SAT mock testlar, savollar banki va natijalar tahlili.",
  alternates: { canonical: '/login' },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
