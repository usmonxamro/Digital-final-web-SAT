'use client'

import { ArrowRight, BookOpen, Crown, FileText, Flame, Lock, Send, Trophy, Users } from 'lucide-react'
import type { ReactNode } from 'react'

type Variant = 'books' | 'chart'

const VARIANTS: Record<Variant, { badge: string; BadgeIcon: typeof Crown; hot: boolean; chips: { Icon: typeof Trophy; t: string; s: string }[] }> = {
  books: {
    badge: 'Top guruh',
    BadgeIcon: Crown,
    hot: true,
    chips: [
      { Icon: Trophy, t: '800/800', s: 'Maqsad natija' },
      { Icon: FileText, t: 'Vazifalar', s: 'Har kuni' },
      { Icon: Users, t: 'Mentor nazorati', s: 'Telegramda' },
    ],
  },
  chart: {
    badge: 'Mashhur guruh',
    BadgeIcon: Flame,
    hot: false,
    chips: [
      { Icon: Trophy, t: '800/800', s: 'Maqsad natija' },
      { Icon: FileText, t: 'Vazifalar', s: 'Har kuni' },
      { Icon: Send, t: 'Telegram guruh', s: 'Vazifa va tahlil' },
    ],
  },
}

function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0-9 2.5-2.5 9 0 2.5 2.5 0 9-2.5 2.5-9 0-2.5-2.5Z" fill="#fbb040" />
}

/** Hand-drawn SVG scene (no external image needed) — stacked SAT books + graduation cap, or a score report with a rising arrow. */
function Art({ variant }: { variant: Variant }) {
  const id = variant
  const defs = (
    <defs>
      <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#ffd9a8" />
        <stop offset="1" stopColor="#ffd9a8" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-or`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffa24a" />
        <stop offset="1" stopColor="#ee5a0a" />
      </linearGradient>
      <linearGradient id={`${id}-or2`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffb866" />
        <stop offset="1" stopColor="#f26b12" />
      </linearGradient>
      <linearGradient id={`${id}-dk`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3a4150" />
        <stop offset="1" stopColor="#12161f" />
      </linearGradient>
      <linearGradient id={`${id}-pg`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" />
        <stop offset="1" stopColor="#ffeede" />
      </linearGradient>
    </defs>
  )
  if (variant === 'books') {
    return (
      <svg viewBox="0 0 200 180" className="sd-cc-art" aria-hidden>
        {defs}
        <circle cx="104" cy="104" r="84" fill={`url(#${id}-glow)`} />
        <ellipse cx="104" cy="160" rx="62" ry="8" fill="#e8590c" opacity=".16" />
        {/* bottom book */}
        <path d="M36 122 100 108l66 14v26l-66 14-64-14Z" fill={`url(#${id}-or)`} />
        <path d="M36 122 100 108l66 14-66 14Z" fill="#ffc27d" />
        <path d="M36 122v26l64 14v-26Z" fill="#c94a06" />
        <path d="M44 138l54 12v6l-54-12Z" fill="#fff" opacity=".9" />
        <text transform="translate(66 146) rotate(14)" fontSize="17" fontWeight="800" fill="#fff">SAT</text>
        {/* top book (smaller, offset) */}
        <path d="M52 96 104 84l54 12v22l-54 12-52-12Z" fill={`url(#${id}-or2)`} />
        <path d="M52 96 104 84l54 12-54 12Z" fill="#ffd29c" />
        <path d="M52 96v22l52 12v-22Z" fill="#d85208" />
        <path d="M58 109l42 10v5l-42-10Z" fill="#fff" opacity=".9" />
        <text transform="translate(74 118) rotate(14)" fontSize="14" fontWeight="800" fill="#fff">SAT</text>
        {/* cap */}
        <path d="M82 60v20c0 9 44 10 44 0V60Z" fill={`url(#${id}-dk)`} />
        <path d="M104 30 156 52 104 74 52 52Z" fill={`url(#${id}-dk)`} />
        <path d="M104 30 156 52 104 74 52 52Z" fill="none" stroke="#4b5563" strokeWidth="1.5" />
        <path d="M104 33 146 52 104 70 62 52Z" fill="#2a303c" opacity=".55" />
        <circle cx="104" cy="52" r="3" fill="#f59e0b" />
        <path d="M104 52 150 56v28" fill="none" stroke="#f59e0b" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M150 84l-4 12h8Z" fill="#f59e0b" />
        <Sparkle x={34} y={64} s={1.2} />
        <Sparkle x={172} y={28} s={.9} />
        <Sparkle x={184} y={120} s={.7} />
        <Sparkle x={24} y={118} s={.55} />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 200 180" className="sd-cc-art" aria-hidden>
      {defs}
      <circle cx="108" cy="100" r="84" fill={`url(#${id}-glow)`} />
      <ellipse cx="112" cy="162" rx="58" ry="8" fill="#e8590c" opacity=".16" />
      {/* tilted report */}
      <g transform="rotate(-7 100 96)">
        <rect x="52" y="22" width="96" height="124" rx="10" fill="#e9d9c8" opacity=".6" transform="translate(5 5)" />
        <rect x="52" y="22" width="96" height="124" rx="10" fill={`url(#${id}-pg)`} stroke="#fde0c4" strokeWidth="2" />
        <text x="100" y="58" textAnchor="middle" fontSize="23" fontWeight="800" fill="#1f2937">SAT</text>
        <rect x="66" y="70" width="68" height="5" rx="2.5" fill="#fbd5b0" />
        <rect x="66" y="82" width="52" height="5" rx="2.5" fill="#fbd5b0" />
        <rect x="66" y="94" width="60" height="5" rx="2.5" fill="#fbd5b0" />
      </g>
      {/* bars */}
      <rect x="118" y="116" width="15" height="30" rx="3.5" fill="#fdc78e" />
      <rect x="136" y="100" width="15" height="46" rx="3.5" fill={`url(#${id}-or2)`} />
      <rect x="154" y="82" width="15" height="64" rx="3.5" fill={`url(#${id}-or)`} />
      {/* arrow */}
      <path d="M84 126 120 96l16 11 38-44" fill="none" stroke="#c94a06" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity=".25" transform="translate(0 3)" />
      <path d="M84 126 120 96l16 11 38-44" fill="none" stroke={`url(#${id}-or)`} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M156 60h24v24" fill="none" stroke={`url(#${id}-or)`} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <Sparkle x={30} y={104} s={1.1} />
      <Sparkle x={26} y={46} s={.7} />
      <Sparkle x={188} y={118} s={.8} />
      <Sparkle x={170} y={22} s={.6} />
    </svg>
  )
}

/** Course group card (title with orange "800/800", art, three chips, big CTA). */
export function CourseCard({
  name,
  index,
  unlocked,
  taskCount,
  onOpen,
  children,
}: {
  name: string
  index: number
  unlocked: boolean
  taskCount: number
  onOpen: () => void
  children?: ReactNode
}) {
  const variant: Variant = index % 2 === 0 ? 'books' : 'chart'
  const v = VARIANTS[variant]
  const m = name.match(/^(.*?)(\d+\/\d+)(.*)$/)
  return (
    <div className="sd-cc">
      <div className="sd-cc-body">
        <div className="sd-cc-top">
          <span className="sd-cc-icon"><BookOpen /></span>
          <span className={`sd-cc-tag ${v.hot ? 'sd-cc-tag-hot' : ''}`}>
            <v.BadgeIcon size={14} /> {v.badge}
          </span>
          <span className={`sd-course-badge ${unlocked ? '' : 'sd-locked'}`}>{unlocked ? "A'zo" : 'Qabul ochiq'}</span>
        </div>
        <h3 className="sd-cc-title">
          {m ? (<>{m[1]}<em>{m[2]}</em>{m[3]}</>) : name}
        </h3>
        <p className="sd-cc-sub">
          {taskCount > 0 ? `${taskCount} ta mashg'ulot` : 'Vazifalar tez orada'} · Telegram guruhi vazifalari
        </p>
        <Art variant={variant} />
        <div className="sd-cc-chips">
          {v.chips.map(({ Icon, t, s }) => (
            <div key={t} className="sd-cc-chip">
              <span><Icon /></span>
              <div>
                <b>{t}</b>
                <small>{s}</small>
              </div>
            </div>
          ))}
        </div>
        <button className={`sd-cc-cta ${unlocked ? '' : 'sd-cc-cta-soft'}`} onClick={onOpen}>
          {unlocked ? 'Vazifalarni ko‘rish' : (<><Lock size={16} /> Kursni ko‘rish</>)}
          <span className="sd-cc-arrow"><ArrowRight size={18} /></span>
        </button>
        {children}
      </div>
    </div>
  )
}
