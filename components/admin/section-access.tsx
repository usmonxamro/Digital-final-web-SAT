'use client'

import { Lock, Sparkles, GraduationCap, Gift } from 'lucide-react'

export type Section = 'exams' | 'free'
export type Access = 'free' | 'paid'

/** What the admin chose for the mock that is about to be saved (read by saveTestConfig in app/admin/page.tsx). */
export const newMockOptions: { section: Section; access: Access } = { section: 'exams', access: 'free' }

const base =
  'group flex flex-1 min-w-[150px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5'

function Choice({
  active,
  onClick,
  icon,
  title,
  hint,
  gradient,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  hint: string
  gradient: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${base} ${
        active ? `border-transparent text-white shadow-[0_8px_22px_rgba(0,0,0,.16)] ${gradient}` : 'border-line bg-white text-ink hover:border-ink-faint'
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? 'bg-white/25' : 'bg-bg-deep text-ink-soft'}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-extrabold leading-tight">{title}</span>
        <span className={`block text-[11px] leading-snug ${active ? 'text-white/85' : 'text-ink-faint'}`}>{hint}</span>
      </span>
    </button>
  )
}

/** Two big pill-cards pairs: where the mock lives (All Past Exams / Free Mocks) and whether it is free or paid. */
export function SectionAccessPicker({
  section,
  access,
  onChange,
  busy,
}: {
  section: Section
  access: Access
  onChange: (v: { section: Section; access: Access }) => void
  busy?: boolean
}) {
  return (
    <div className={`space-y-2.5 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="flex flex-wrap gap-2.5">
        <Choice
          active={section === 'exams'}
          onClick={() => onChange({ section: 'exams', access })}
          icon={<GraduationCap size={18} />}
          title="All Past Exams"
          hint="Imtihonga tushgan versiyalar"
          gradient="bg-[linear-gradient(135deg,#2563eb,#38bdf8)]"
        />
        <Choice
          active={section === 'free'}
          onClick={() => onChange({ section: 'free', access })}
          icon={<Sparkles size={18} />}
          title="Free Mocks"
          hint="O'zim tuzgan mashq testlar"
          gradient="bg-[linear-gradient(135deg,#ff6600,#f59e0b)]"
        />
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Choice
          active={access === 'free'}
          onClick={() => onChange({ section, access: 'free' })}
          icon={<Gift size={18} />}
          title="Bepul"
          hint="Hamma ochib yecha oladi"
          gradient="bg-[linear-gradient(135deg,#059669,#34d399)]"
        />
        <Choice
          active={access === 'paid'}
          onClick={() => onChange({ section, access: 'paid' })}
          icon={<Lock size={18} />}
          title="Pullik"
          hint="Qulf belgisi, Pro / kurs o'quvchilari uchun"
          gradient="bg-[linear-gradient(135deg,#d97706,#fbbf24)]"
        />
      </div>
    </div>
  )
}
