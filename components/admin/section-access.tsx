'use client'

import { Lock, Sparkles, GraduationCap, Gift, FileDown } from 'lucide-react'
import type { MockSection } from '@/lib/mock-sections'

export type Section = MockSection
export type Access = 'free' | 'paid'

/** What the admin chose for the mock that is about to be saved (read by saveTestConfig in app/admin/page.tsx). */
export const newMockOptions: { sections: Section[]; access: Access; pdf: boolean } = { sections: ['exams'], access: 'free', pdf: false }

export type Placement = { sections: Section[]; access: Access; pdf: boolean }

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

/**
 * Big pill-cards: where the mock lives (All Past Exams and/or Free Mocks — both can be on at once),
 * whether it is free or paid, and whether students may download its questions as a PDF after finishing.
 */
export function SectionAccessPicker({
  sections,
  access,
  pdf,
  onChange,
  busy,
}: {
  sections: Section[]
  access: Access
  pdf: boolean
  onChange: (v: Placement) => void
  busy?: boolean
}) {
  const toggle = (s: Section) =>
    onChange({ sections: sections.includes(s) ? sections.filter((x) => x !== s) : [...sections, s], access, pdf })
  return (
    <div className={`space-y-2.5 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="flex flex-wrap gap-2.5">
        <Choice
          active={sections.includes('exams')}
          onClick={() => toggle('exams')}
          icon={<GraduationCap size={18} />}
          title="All Past Exams"
          hint="Imtihonga tushgan versiyalar"
          gradient="bg-[linear-gradient(135deg,#2563eb,#38bdf8)]"
        />
        <Choice
          active={sections.includes('free')}
          onClick={() => toggle('free')}
          icon={<Sparkles size={18} />}
          title="Free Mocks"
          hint="O'zim tuzgan mashq testlar"
          gradient="bg-[linear-gradient(135deg,#ff6600,#f59e0b)]"
        />
      </div>
      <p className="text-[11px] text-ink-faint">
        {sections.length === 0
          ? 'Hech qaysi bo‘limda ko‘rinmaydi (faqat kurs guruhi yoki to‘g‘ridan-to‘g‘ri havola orqali).'
          : 'Ikkalasini ham tanlash mumkin — mock bir vaqtda ikkala bo‘limda ko‘rinadi.'}
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Choice
          active={access === 'free'}
          onClick={() => onChange({ sections, access: 'free', pdf })}
          icon={<Gift size={18} />}
          title="Bepul"
          hint="Hamma ochib yecha oladi"
          gradient="bg-[linear-gradient(135deg,#059669,#34d399)]"
        />
        <Choice
          active={access === 'paid'}
          onClick={() => onChange({ sections, access: 'paid', pdf })}
          icon={<Lock size={18} />}
          title="Pullik"
          hint="Qulf belgisi, Pro / kurs o'quvchilari uchun"
          gradient="bg-[linear-gradient(135deg,#d97706,#fbbf24)]"
        />
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Choice
          active={pdf}
          onClick={() => onChange({ sections, access, pdf: !pdf })}
          icon={<FileDown size={18} />}
          title="PDF yuklab olish"
          hint={pdf ? 'Test tugagach o‘quvchi savollarni PDF qilib yuklab oladi' : 'Hozir o‘chiq — o‘quvchi PDF ololmaydi'}
          gradient="bg-[linear-gradient(135deg,#7c3aed,#a78bfa)]"
        />
      </div>
    </div>
  )
}
