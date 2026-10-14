'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowUpRight, Bell, ChartColumn, FileText, GraduationCap, House, Layers, BookOpen, Menu, Search, Settings, Sparkles } from 'lucide-react'
import { useUser } from '@/components/marketing/dashboard/user-context'
import { DashboardDataProvider } from '@/components/marketing/dashboard/dashboard-data'
import { SdUiProvider, useSd } from '@/components/marketing/dashboard/sd-ui'
import { ThemeSwitch } from '@/components/marketing/theme-switch'
import { LangSwitch } from '@/components/lang-switch'
import { LangPicker } from '@/components/marketing/dashboard/lang-picker'
import { useT } from '@/components/i18n-provider'

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
          <LangPicker />
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
  const t = useT()
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
          <small>{t('LEARNING PLATFORM')}</small>
        </span>
      </Link>
      <div className="sd-nav-label">{t('MENU')}</div>
      <nav className="sd-nav">
        {NAV.map(({ href, hash: h, label, Icon, badge }) => (
          <Link key={label} href={href + h} className={`sd-nav-btn ${active({ href, hash: h } as (typeof NAV)[number]) ? 'sd-active' : ''}`}>
            <i>
              <Icon />
            </i>
            <span>{t(label)}</span>
            {badge && <span className="sd-count">{badge}</span>}
          </Link>
        ))}
      </nav>
      <div className="sd-sidebar-bottom">
        <BalanceCard />
        <div className="sd-support">
          <strong>{t('Yordam kerakmi?')}</strong>
          <p>{t("Darslar, testlar yoki hisobingiz bo'yicha savollaringiz bormi?")}</p>
          <button className="sd-text-btn" onClick={() => openModal('help')}>
            {t('Yordam markazi')} <ArrowUpRight size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />
          </button>
        </div>
        <p className="sd-copy">© 2026 SAT Akademiyasi · satbyusmon.com</p>
      </div>
    </aside>
  )
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const t = useT()
  const user = useUser()
  const router = useRouter()
  const { openModal } = useSd()
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const isPro = user.plan === 'premium'
  const planLabel = isPro ? (user.trialDaysLeft ? `PRO · ${t('{n} kun', { n: user.trialDaysLeft })}` : 'PRO') : 'FREE'

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
        <button className="sd-icon-btn sd-menu-btn" onClick={onMenu} aria-label={t('Menyuni ochish')}>
          <Menu />
        </button>
        <form className="sd-search" onSubmit={search} role="search">
          <Search size={17} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Testlar yoki kurslarni qidirish...')}
            aria-label={t('Qidirish')}
            autoComplete="off"
          />
          <kbd>Ctrl K</kbd>
        </form>
      </div>
      <div className="sd-top-right">
        <LangSwitch />
        <ThemeSwitch />
        <div className="sd-pill">
          <button className="sd-pill-bell" onClick={() => openModal('notifications')} aria-label={t('Bildirishnomalar')}>
            <Bell />
          </button>
          <Link href="/dashboard/profile" className="sd-pill-user" aria-label="Profil">
            <span className="sd-user-avatar">{user.firstName.slice(0, 1).toUpperCase()}</span>
            <span className="sd-user-text">
              <strong>{[user.firstName, user.lastName].filter(Boolean).join(' ')}</strong>
              <small className={`sd-plan ${isPro ? 'sd-plan-pro' : ''}`}>{planLabel}</small>
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}

/** Sidebar "Balans" card — there is no money balance, so it shows the plan and today's mock allowance. */
function BalanceCard() {
  const t = useT()
  const user = useUser()
  const { openModal } = useSd()
  const [quota, setQuota] = useState<{ usedToday: number; perDay: number } | null>(null)
  const [unlimited, setUnlimited] = useState(false)
  useEffect(() => {
    let off = false
    fetch('/api/exam/quota')
      .then((r) => r.json())
      .then((d) => {
        if (off) return
        if (d?.unlimited) setUnlimited(true)
        else if (d?.quota) setQuota({ usedToday: d.quota.usedToday, perDay: d.quota.perDay })
      })
      .catch(() => {})
    return () => {
      off = true
    }
  }, [])
  const isPro = user.plan === 'premium'
  const left = quota ? Math.max(0, quota.perDay - quota.usedToday) : null
  return (
    <div className="sd-balance sd-balance-click" role="button" tabIndex={0} onClick={() => openModal('plans')} onKeyDown={(e) => e.key === 'Enter' && openModal('plans')}>
      <div className="sd-balance-head">
        <span>{t('Balansim')}</span>
        <b className={isPro ? 'sd-plan-pro' : ''}>{isPro ? 'PRO' : 'FREE'}</b>
      </div>
      {unlimited ? (
        <div className="sd-balance-big">{t('Cheksiz')}</div>
      ) : (
        <>
          <div className="sd-balance-big">
            {left ?? '–'} <small>{t('ta mock qoldi')}</small>
          </div>
          {quota && (
            <div className="sd-balance-bar">
              <i style={{ width: `${Math.min(100, (quota.usedToday / quota.perDay) * 100)}%` }} />
            </div>
          )}
          <p>{t('Bugun: {x} mock yechildi', { x: quota ? `${quota.usedToday}/${quota.perDay}` : '–' })}</p>
        </>
      )}
      {isPro && user.trialDaysLeft ? <p>{t('Bepul PRO: yana {n} kun', { n: user.trialDaysLeft })}</p> : null}
      {!isPro && (
        <button className="sd-text-btn" onClick={(e) => { e.stopPropagation(); openModal('plans') }}>
          {t("PRO ga o'tish")} <ArrowUpRight size={13} style={{ display: 'inline', verticalAlign: '-2px' }} />
        </button>
      )}
    </div>
  )
}
