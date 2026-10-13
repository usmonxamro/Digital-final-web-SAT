'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Dumbbell, GraduationCap, BookOpen, User } from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Bosh sahifa', icon: Home },
  { href: '/dashboard/practice', label: 'Testlar', icon: Dumbbell },
  { href: '/dashboard/course-tasks', label: 'Vazifalar', icon: GraduationCap },
  { href: '/dashboard/question-bank', label: 'Savol banki', icon: BookOpen },
  { href: '/dashboard/profile', label: 'Profil', icon: User },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-sp-border bg-sp-header backdrop-blur-md flex">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold ${
              active ? 'text-sp-orange' : 'text-sp-text-muted'
            }`}
          >
            <Icon size={19} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
