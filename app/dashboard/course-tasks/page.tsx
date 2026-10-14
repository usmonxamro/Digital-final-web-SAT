'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronLeft, Clock, KeyRound, Lock, Play } from 'lucide-react'
import { useDashboardData, type TestSummary } from '@/components/marketing/dashboard/dashboard-data'
import { useUser } from '@/components/marketing/dashboard/user-context'
import { useSd } from '@/components/marketing/dashboard/sd-ui'
import { CourseCard } from '@/components/marketing/dashboard/course-card'
import { COURSE_GROUPS } from '@/lib/course-groups'

/** "December Intensive — Week 1" → course "December Intensive"; labels without a dash go to "Umumiy vazifalar". */
function courseOf(label: string): { course: string; task: string } {
  const m = label.match(/^(.{3,}?)\s+[—–-]\s+(.+)$/)
  return m ? { course: m[1].trim(), task: m[2].trim() } : { course: 'Umumiy vazifalar', task: label }
}

type Course = { name: string; slug: string | null; tasks: { task: string; test: TestSummary }[] }

export default function CourseTasksPage() {
  const { tests } = useDashboardData()
  const user = useUser()
  const { openModal } = useSd()
  const access = useMemo(
    () => ({ all: user.courseAll ?? user.courseMember !== false, groups: user.courseGroups ?? [] }),
    [user.courseAll, user.courseMember, user.courseGroups],
  )
  const member = access.all || access.groups.length > 0
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    setOpen(new URLSearchParams(window.location.search).get('course'))
  }, [])

  const courses = useMemo<Course[]>(() => {
    // The defined groups are always listed (even before their first task); other task groups follow.
    const map = new Map<string, Course>()
    for (const g of COURSE_GROUPS) map.set(g.title.toLowerCase(), { name: g.title, slug: g.slug, tasks: [] })
    for (const t of (tests ?? []).filter((x) => x.placement === 'course_task')) {
      const { course, task } = courseOf(t.label)
      const key = course.toLowerCase()
      const c = map.get(key) ?? { name: course, slug: null, tasks: [] }
      c.tasks.push({ task, test: t })
      map.set(key, c)
    }
    const defined = COURSE_GROUPS.map((g) => map.get(g.title.toLowerCase())!)
    const others = [...map.values()].filter((c) => !c.slug).sort((a, b) => a.name.localeCompare(b.name))
    return [...defined, ...others]
  }, [tests])

  const unlocked = (c: Course) => (c.slug ? access.all || access.groups.includes(c.slug) : member)
  const current = open ? courses.find((c) => c.name === open && unlocked(c)) ?? null : null

  function pick(c: Course) {
    if (!unlocked(c)) {
      openModal('locked')
      return
    }
    setOpen(c.name)
    window.history.replaceState(null, '', `/dashboard/course-tasks?course=${encodeURIComponent(c.name)}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (current) {
    return (
      <>
        <button
          className="sd-back"
          onClick={() => {
            setOpen(null)
            window.history.replaceState(null, '', '/dashboard/course-tasks')
          }}
        >
          <ChevronLeft size={15} /> Kurslarga qaytish
        </button>
        <div className="sd-page-header">
          <div>
            <div className="sd-eyebrow">My Courses / {current.name}</div>
            <h1>{current.name}</h1>
          </div>
          <span className="sd-pill">A&apos;zo</span>
        </div>
        <p className="sd-note">Guruhingizning mashg&apos;ulotlari va vazifalari. Vaqt cheklovi yo&apos;q — taymer sarflangan vaqtingizni sanab boradi.</p>
        {current.tasks.map(({ task, test: t }, i) => {
          const count = t.subject === 'math' ? t.mathCount : t.readingCount
          const ready = count >= 1
          return (
            <div key={t.label} className={`sd-detail-card ${ready ? '' : 'sd-soon'}`}>
              <div className="sd-version-badge">{String(i + 1).padStart(2, '0')}</div>
              <div className="sd-detail-body">
                <strong>{task}</strong>
                <div className="sd-chips">
                  <span className="sd-chip">
                    <Clock /> {count} savol · vaqt cheklovsiz
                  </span>
                </div>
              </div>
              <div className="sd-detail-actions">
                {ready ? (
                  <Link href={`/exam?test=${encodeURIComponent(t.label)}`} className="sd-primary">
                    <Play /> Ishlash
                  </Link>
                ) : (
                  <span className="sd-soft sd-lock-btn">
                    <Lock /> Hali savol yo&apos;q
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </>
    )
  }

  return (
    <>
      <div className="sd-page-header">
        <div>
          <div className="sd-eyebrow">SAT Akademiyasi / Kurslar</div>
          <h1>Mening kurslarim</h1>
        </div>
        <button className="sd-soft" onClick={() => openModal('code')}>
          <KeyRound size={14} /> Kod bilan qo&apos;shilish
        </button>
      </div>
      <p className="sd-note">
        {member
          ? "Telegram guruhingizdagi darslarga tegishli vazifalar. Guruhingizni tanlang va ichidagi vazifalarni ishlang."
          : "Hozirda faol kurslar. Vazifalarni ishlash uchun tayyorlov kurslarimizga qo'shilishingiz kerak."}
      </p>
      <div className="sd-section-title">
        <h3>{member ? 'Kurs guruhlari' : 'Hozirda faol kurslar'}</h3>
      </div>
      <div className="sd-course-grid">
        {tests === null && <div className="sd-panel sd-empty">Yuklanmoqda...</div>}
        {courses.map((c, i) => (
          <CourseCard
            key={c.name}
            name={c.name}
            index={i}
            unlocked={unlocked(c)}
            taskCount={c.tasks.length}
            onOpen={() => pick(c)}
          />
        ))}
      </div>
    </>
  )
}
