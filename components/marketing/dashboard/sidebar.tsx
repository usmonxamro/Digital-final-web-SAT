'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Home, Dumbbell, BookOpen, GraduationCap, User, Crown, LogOut } from 'lucide-react'
import { Logo } from '@/components/marketing/logo'
import { useUser } from '@/components/marketing/dashboard/user-context'

const NAV = [
  { href: '/dashboard', label: 'Bosh sahifa', icon: Home },
  { href: '/dashboard/practice', label: 'Mock testlar', icon: Dumbbell },
  { href: '/dashboard/course-tasks', label: 'Course vazifalar', icon: GraduationCap },
  { href: '/dashboard/question-bank', label: 'Savol banki', icon: BookOpen },
  { href: '/dashboard/profile', label: 'Profil', icon: User },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useUser()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex flex-col w-[260px] shrink-0 bg-sp-bg border-r border-sp-border p-4.5">
      <div className="flex items-center px-2 pb-6">
        <Logo size="sm" subtitle={false} />
      </div>

      <nav className="flex flex-col gap-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-[10px] text-[14px] font-medium transition-all duration-300 border ${
                active
                  ? 'bg-sp-orange/[0.12] text-sp-orange border-sp-orange/30'
                  : 'text-sp-text-muted border-transparent hover:bg-sp-orange/[0.12] hover:text-sp-orange hover:border-sp-orange/30'
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3">
        {user.plan !== 'premium' && (
          <div className="rounded-[14px] p-4 sp-glass border-sp-yellow/30">
            <div className="flex items-center gap-1.5 font-extrabold text-[14.5px] text-sp-text">
              <Crown size={15} className="text-sp-yellow" /> Premium&apos;ga o&apos;ting
            </div>
            <p className="text-[12px] text-sp-text-muted mt-1.5 leading-relaxed">
              Adaptiv modul, video darslar va batafsil tahlilga ega bo&apos;ling.
            </p>
            <button className="mt-2.5 w-full py-2 rounded-lg text-[12.5px] font-extrabold text-[#1A1200] bg-[linear-gradient(135deg,var(--sp-yellow),var(--sp-yellow-glow))]">
              Ko&apos;proq bilish
            </button>
          </div>
        )}

        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold text-sp-text-muted hover:text-red-400 hover:bg-red-500/5 transition-colors"
        >
          <LogOut size={16} /> Chiqish
        </button>
      </div>
    </aside>
  )
}
