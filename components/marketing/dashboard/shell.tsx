'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowUpRight, Bell, ChartColumn, FileText, GraduationCap, House, Layers, BookOpen, Menu, MoonStar, Search, Settings, Sparkles, Sun } from 'lucide-react'
import { useUser } from '@/components/marketing/dashboard/user-context'
import { DashboardDataProvider } from '@/components/marketing/dashboard/dashboard-data'
import { SdUiProvider, useSd } from '@/components/marketing/dashboard/sd-ui'

const NAV = [
  { href: '/dashboard', hash: '', label: 'Dashboard', Icon: House },
  { href: '/dashboard/practice', hash: '', label: 'All Past Exams', Icon: FileText, badge: 'NEW' },
  { href: '/dashboard/free-mocks', hash: '', label: 'Free Mocks', Icon: Sparkles, badge: 'FREE' },
  { href: '/dashboard/course-tasks', hash: '', label: 'My Courses', Icon: BookOpen },
  { href: '/dashboard/question-bank', hash: '', label: 'Savol banki', Icon: Layers },
  { href: '/dashboard', hash: '#results', label: 'Natijalarim', Icon: ChartColumn },
  { href: '/dashboard/profile', hash: '', label: 'Sozlamalar', Icon: Settings },
]

/** Sidebar + top bar of the student dashboard (styles: app/dashboard/sd.css). */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardDataProvider>
      <div className="sd-root font-sans">
        <SdUiProvider>
          <Frame>{children}</Frame>
        </SdUiProvider>
      </div>
    </DashboardDataProvider>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [hash, setHash] = useState('')

  useEffect(() => setOpen(false), [pathname, hash])
  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [pathname])

  return (
    <>
      <div className="sd-app">
        <Sidebar open={open} pathname={pathname} hash={hash} />
        <div className={`sd-backdrop ${open ? 'sd-show' : ''}`} onClick={() => setOpen(false)} />
        <div className="sd-main">
          <TopBar onMenu={() => setOpen((v) => !v)} />
          <main className="sd-content" id="dashboard">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}

function Sidebar({ open, pathname, hash }: { open: boolean; pathname: string; hash: string }) {
  const { openModal } = useSd()
  const active = (n: (typeof NAV)[number]) => {
    if (n.hash) return pathname === '/dashboard' && hash === n.hash
    if (n.href === '/dashboard') return pathname === '/dashboard' && !hash
    return pathname === n.href || pathname.startsWith(n.href + '/')
  }

  return (
    <aside className={`sd-sidebar ${open ? 'sd-open' : ''}`} id="sidebar">
      <Link className="sd-brand" href="/dashboard">
        <span className="sd-brand-mark">
          <GraduationCap />
        </span>
        <span>
          <b>SAT Akademiyasi</b>
          <small>LEARNING PLATFORM</small>
        </span>
      </Link>
      <div className="sd-nav-label">MENU</div>
      <nav className="sd-nav">
        {NAV.map(({ href, hash: h, label, Icon, badge }) => (
          <Link key={label} href={href + h} className={`sd-nav-btn ${active({ href, hash: h } as (typeof NAV)[number]) ? 'sd-active' : ''}`}>
            <i>
              <Icon />
            </i>
            <span>{label}</span>
            {badge && <span className="sd-count">{badge}</span>}
          </Link>
        ))}
      </nav>
      <div className="sd-sidebar-bottom">
        <div className="sd-support">
          <strong>Yordam kerakmi?</strong>
          <p>Darslar, testlar yoki hisobingiz bo&apos;yicha savollaringiz bormi?</p>
          <button className="sd-text-btn" onClick={() => openModal('help')}>
            Yordam markazi <ArrowUpRight size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />
          </button>
        </div>
        <p className="sd-copy">© 2026 SAT Akademiyasi</p>
      </div>
    </aside>
  )
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const user = useUser()
  const router = useRouter()
  const { openModal } = useSd()
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function search(e: React.FormEvent) {
    e.preventDefault()
    const v = q.trim()
    if (v) router.push(`/dashboard/practice?q=${encodeURIComponent(v)}`)
  }

  return (
    <header className="sd-topbar">
      <div className="sd-top-left">
        <button className="sd-icon-btn sd-menu-btn" onClick={onMenu} aria-label="Menyuni ochish">
          <Menu />
        </button>
        <form className="sd-search" onSubmit={search} role="search">
          <Search size={17} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Testlar yoki kurslarni qidirish..."
            aria-label="Qidirish"
            autoComplete="off"
          />
          <kbd>Ctrl K</kbd>
        </form>
      </div>
      <div className="sd-top-right">
        <ThemeSwitch />
        <button className="sd-icon-btn" onClick={() => openModal('notifications')} aria-label="Bildirishnomalar">
          <Bell />
        </button>
        <Link href="/dashboard/profile" className="sd-user" aria-label="Profil">
          <span className="sd-user-avatar">{user.firstName.slice(0, 1).toUpperCase()}</span>
          <span className="sd-user-text">
            <strong>{user.firstName}</strong>
            <small>O&apos;quvchi profili</small>
          </span>
        </Link>
      </div>
    </header>
  )
}

function ThemeSwitch() {
  const [dark, setDark] = useState<boolean | null>(null)
  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-sp-theme') !== 'light')
  }, [])
  function toggle() {
    const next = dark ? 'light' : 'dark'
    setDark(next === 'dark')
    document.documentElement.setAttribute('data-sp-theme', next)
    try {
      localStorage.setItem('sp-theme', next)
    } catch {
      /* private mode */
    }
  }
  return (
    <button
      type="button"
      className="sd-theme"
      onClick={toggle}
      aria-pressed={!!dark}
      aria-label={dark ? 'Kunduzgi rejimga o‘tish' : 'Tungi rejimga o‘tish'}
      title={dark ? 'Kunduzgi rejimni yoqish' : 'Tungi rejimni yoqish'}
    >
      <span className={dark === false ? 'sd-on' : ''}>
        <Sun />
      </span>
      <span className={dark ? 'sd-on' : ''}>
        <MoonStar />
      </span>
    </button>
  )
}
