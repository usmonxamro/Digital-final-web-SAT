'use client'

import { ThemeSwitch } from '@/components/marketing/theme-switch'

/** Kept for existing imports — now the shared sun/moon switch. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  return <ThemeSwitch className={className} />
}
