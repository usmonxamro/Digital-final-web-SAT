'use client'

import { SatSkeleton } from '@/components/sat-loader'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronLeft, Clock, KeyRound, Lock, Play } from 'lucide-react'
import { useDashboardData, type TestSummary } from '@/components/marketing/dashboard/dashboard-data'
import { useUser } from '@/components/marketing/dashboard/user-context'
import { useSd } from '@/components/marketing/dashboard/sd-ui'
import { CourseCard } from '@/components/marketing/dashboard/course-card'
import { COURSE_GROUPS, groupsOfTask } from '@/lib/course-groups'

type Course = { name: string; slug: string; tasks: { task: string; test: TestSummary }[] }

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

  // Only the defined groups (Noyabr / Dekabr) are listed. A task or mock shows up in a group when the
  // admin gave it to that group (a mock can be in several groups), or — for older tasks — when its
  // name starts with the group's title. Anything not given to a group is simply not shown here.
  const courses = useMemo<Course[]>(() => {
    return COURSE_GROUPS.map((g) => {
      const prefix = new RegExp(`^${g.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[—–-]\\s*`, 'i')
      const tasks = (tests ?? [])
        .filter((t) => groupsOfTask(t.label, t.courseGroups).includes(g.slug) && (t.placement === 'course_task' || !!t.courseGroups?.includes(g.slug)))
        .map((t) => ({ task: t.label.replace(prefix, '').trim() || t.label, test: t }))
      return { name: g.title, slug: g.slug, tasks }
    })
  }, [tests])

  const unlocked = (c: Course) => access.all || access.groups.includes(c.slug)
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
        <p className="sd-note">Guruhingizning mashg&apos;ulotlari va vazifalari. Vazifalarda vaqt cheklovi yo&apos;q — taymer sarflangan vaqtingizni sanab boradi; vaqtli mocklarda vaqt tugasa, davom etish yoki yakunlashni tanlaysiz.</p>
        {current.tasks.map(({ task, test: t }, i) => {
          const count = t.subject === 'full' ? t.readingCount + t.mathCount : t.subject === 'math' ? t.mathCount : t.readingCount
          const ready = count >= 1
          const isTask = t.placement === 'course_task'
          return (
            <div key={t.label} className={`sd-detail-card ${ready ? '' : 'sd-soon'}`}>
              <div className="sd-version-badge">{String(i + 1).padStart(2, '0')}</div>
              <div className="sd-detail-body">
                <strong>{task}</strong>
                <div className="sd-chips">
                  <span className="sd-chip">
                    <Clock /> {count} savol
                    {isTask ? ' · vaqt cheklovsiz' : ' · vaqtli mock'}
                    {isTask && t.recommendedMinutes ? ` · tavsiya: ${t.recommendedMinutes} daq` : ''}
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
        {tests === null && <div style={{ gridColumn: '1 / -1' }}><SatSkeleton kind="cards" count={3} /></div>}
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
