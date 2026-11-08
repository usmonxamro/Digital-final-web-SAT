'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BookMarked, BookOpen, ChartColumn, FileText, House, Layers, Search, Settings, Sparkles, X } from 'lucide-react'
import { useDashboardData } from '@/components/marketing/dashboard/dashboard-data'
import { useSd } from '@/components/marketing/dashboard/sd-ui'
import { useT } from '@/components/i18n-provider'
import { examNameOf } from '@/lib/exam-groups'
import { inSection } from '@/lib/mock-sections'

type Hit = {
  key: string
  title: string
  sub: string
  href?: string
  action?: () => void
  Icon: typeof House
  /** Extra words the item is found by (not shown). */
  words?: string
}

/** Pages + settings the search knows about (mocks are added from the live catalogue). */
const PAGES: Omit<Hit, 'key'>[] = [
  { title: 'Bosh sahifa', sub: 'Sahifa', href: '/dashboard', Icon: House, words: 'home dashboard asosiy' },
  { title: 'Barcha o‘tgan imtihonlar', sub: 'Sahifa', href: '/dashboard/practice', Icon: FileText, words: 'past exams mock test imtihon' },
  { title: 'Bepul mocklar', sub: 'Sahifa', href: '/dashboard/free-mocks', Icon: Sparkles, words: 'free bepul mock' },
  { title: 'Mening kurslarim', sub: 'Sahifa', href: '/dashboard/course-tasks', Icon: BookOpen, words: 'kurs guruh vazifa course task telegram' },
  { title: 'Savollar banki', sub: 'Sahifa', href: '/dashboard/question-bank', Icon: Layers, words: 'question bank mavzu domain algebra geometry' },
  { title: 'Kitoblar', sub: 'Sahifa', href: '/dashboard/books', Icon: BookMarked, words: 'book kitob sqb pdf' },
  { title: 'Natijalarim', sub: 'Sahifa', href: '/dashboard/results', Icon: ChartColumn, words: 'results ball score natija tahlil' },
  { title: 'Sozlamalar', sub: 'Sozlamalar', href: '/dashboard/profile', Icon: Settings, words: 'settings profil profile' },
  { title: 'Mavzu va ranglar', sub: 'Sozlamalar', href: '/dashboard/profile#theme', Icon: Settings, words: 'theme rang mavzu orange green yellow yashil sariq' },
  { title: 'Kunduzgi / tungi rejim', sub: 'Sozlamalar', href: '/dashboard/profile#theme', Icon: Settings, words: 'dark light night tun kun rejim' },
  { title: 'Til', sub: 'Sozlamalar', href: '/dashboard/profile#lang', Icon: Settings, words: 'language til uz ru en rus ingliz' },
  { title: 'PRO tarif', sub: 'Sozlamalar', href: '/dashboard/profile#pro', Icon: Settings, words: 'pro tarif to‘lov payment premium obuna' },
  { title: 'Chiqish', sub: 'Sozlamalar', href: '/dashboard/profile#logout', Icon: Settings, words: 'logout chiqish exit' },
]

/** Lower-case, apostrophe-insensitive text for matching (o‘ / o' / o` are the same). */
const norm = (s: string) => s.toLowerCase().replace(/[‘’`ʻʼ']/g, "'").replace(/\s+/g, ' ').trim()

/** Top-bar search (Ctrl K): mocks by name, pages and settings. */
export function GlobalSearch() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const { openModal } = useSd()
  const { tests } = useDashboardData()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setMobileOpen(true)
        setOpen(true)
        requestAnimationFrame(() => input.current?.focus())
      }
    }
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false)
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [])
  useEffect(() => {
    setOpen(false)
    setMobileOpen(false)
    setQ('')
  }, [pathname])

  const all = useMemo<Hit[]>(() => {
    const pages: Hit[] = PAGES.map((p, i) => ({ ...p, key: `p${i}`, title: t(p.title), sub: t(p.sub) }))
    pages.push({ key: 'help', title: t('Yordam markazi'), sub: t('Yordam'), Icon: Settings, words: 'help yordam savol support aloqa', action: () => openModal('help') })
    const mocks: Hit[] = (tests ?? []).map((x) => {
      const isTask = x.placement === 'course_task' || ((x.courseGroups?.length ?? 0) > 0 && !inSection(x, 'exams') && !inSection(x, 'free'))
      const href = isTask
        ? '/dashboard/course-tasks'
        : inSection(x, 'exams')
          ? `/dashboard/practice?exam=${encodeURIComponent(examNameOf(x.label))}`
          : '/dashboard/free-mocks'
      const kind = x.subject === 'math' ? 'Math' : x.subject === 'english' ? 'Reading & Writing' : 'Full SAT'
      return {
        key: `m:${x.label}`,
        title: x.label,
        sub: isTask ? t('Kurs vazifasi') : `${t('Mock')} · ${kind}`,
        href,
        Icon: isTask ? BookOpen : FileText,
        words: kind,
      }
    })
    return [...mocks, ...pages]
  }, [tests, t, openModal])

  const hits = useMemo(() => {
    const words = norm(q).split(' ').filter(Boolean)
    if (!words.length) return all.filter((h) => !h.key.startsWith('m:')).slice(0, 8)
    return all
      .map((h) => {
        const hay = norm(`${h.title} ${h.sub} ${h.words ?? ''}`)
        if (!words.every((w) => hay.includes(w))) return null
        const title = norm(h.title)
        const score = (title.startsWith(words[0]) ? 0 : title.includes(words[0]) ? 1 : 2) + (h.key.startsWith('m:') ? 0 : 0.5)
        return { h, score }
      })
      .filter((x): x is { h: Hit; score: number } => !!x)
      .sort((a, b) => a.score - b.score || a.h.title.localeCompare(b.h.title))
      .slice(0, 10)
      .map((x) => x.h)
  }, [all, q])

  useEffect(() => setActive(0), [q])

  function go(h: Hit) {
    setOpen(false)
    setMobileOpen(false)
    setQ('')
    if (h.action) return h.action()
    if (!h.href) return
    const [path] = h.href.split(/[?#]/)
    // Same page with other params/hash: a full navigation so the page re-reads them.
    if (path === pathname) window.location.assign(h.href)
    else router.push(h.href)
  }

  return (
    <div ref={box} className={`sd-gsearch ${mobileOpen ? 'sd-gsearch-open' : ''}`}>
      <button
        type="button"
        className="sd-icon-btn sd-gsearch-toggle"
        aria-label={t('Qidirish')}
        onClick={() => {
          setMobileOpen(true)
          setOpen(true)
          requestAnimationFrame(() => input.current?.focus())
        }}
      >
        <Search />
      </button>
      <form
        className="sd-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (hits[active]) go(hits[active])
        }}
      >
        <Search size={17} />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(hits.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Escape') {
              setOpen(false)
              setMobileOpen(false)
              input.current?.blur()
            }
          }}
          placeholder={t('Mock, sahifa yoki sozlamani qidirish...')}
          aria-label={t('Qidirish')}
          autoComplete="off"
        />
        {q ? (
          <button type="button" className="sd-search-clear" onClick={() => setQ('')} aria-label={t('Tozalash')}>
            <X size={14} />
          </button>
        ) : (
          <kbd>Ctrl K</kbd>
        )}
      </form>
      {open && (
        <div className="sd-search-pop" role="listbox">
          {!q.trim() && <div className="sd-search-head">{t('Tezkor o‘tish')}</div>}
          {hits.length === 0 ? (
            <div className="sd-search-empty">{tests === null ? t('Yuklanmoqda…') : t('Hech narsa topilmadi')}</div>
          ) : (
            hits.map((h, i) => (
              <button
                key={h.key}
                type="button"
                role="option"
                aria-selected={i === active}
                className={`sd-search-item ${i === active ? 'sd-on' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
              >
                <span className="sd-search-ico">
                  <h.Icon />
                </span>
                <span className="sd-search-txt">
                  <b>{h.title}</b>
                  <small>{h.sub}</small>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
