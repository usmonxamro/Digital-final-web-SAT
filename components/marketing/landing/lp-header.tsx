'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/components/i18n-provider'
import { LangSwitch } from '@/components/lang-switch'
import { ThemeSwitch } from '@/components/marketing/theme-switch'
import { lpT } from '@/components/marketing/landing/lp-i18n'

const LINKS = [
  { id: 'home', label: 'Home' },
  { id: 'mock', label: 'Mock Tests' },
  { id: 'books', label: 'Kitoblar' },
  { id: 'courses', label: 'Courses' },
  { id: 'qbank', label: 'Question Bank' },
  { id: 'pricing', label: 'Pricing' },
]

/** Sticky landing header: logo, section links (desktop), language, theme and "Kirish" + "Ro‘yxatdan o‘tish" buttons. */
export function LpHeader() {
  const { lang } = useI18n()
  const [active, setActive] = useState('home')

  // Highlights the link of the section currently in view.
  useEffect(() => {
    const ids = ['home', 'mock', 'books', 'courses', 'pricing']
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (!els.length || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <header>
      <div className="container nav">
        <a href="#home" className="logo">
          <svg className="logo-mark" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M24 2l18 10.5v23L24 46 6 35.5v-23z" fill="#f97316" />
            <path d="M24 14l11 5-11 5-11-5z" fill="#fff" />
            <path d="M17 22.5v6c0 2 3.5 4 7 4s7-2 7-4v-6l-7 3z" fill="#fff" opacity=".9" />
          </svg>
          <span>SAT Akademiyasi</span>
        </a>
        <nav className="menu">
          {LINKS.map((l) => (
            <a key={l.id} href={'#' + l.id} className={active === l.id || (l.id === 'mock' && active === 'qbank') ? 'active' : ''}>
              {lpT(l.label, lang)}
            </a>
          ))}
        </nav>
        <div className="nav-r">
          <LangSwitch />
          <ThemeSwitch defaultTheme="light" />
          <a href="/login" className="btn btn-line">
            {lpT('Kirish', lang)}
          </a>
          <a href="/login?mode=signup" className="btn btn-orange nav-signup">
            {lpT('Ro‘yxatdan o‘tish', lang)}
          </a>
        </div>
      </div>
    </header>
  )
}
