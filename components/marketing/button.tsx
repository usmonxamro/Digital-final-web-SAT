import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'green' | 'glass' | 'gold' | 'ghost'

const base =
  'inline-flex items-center justify-center gap-2 rounded-[10px] font-bold text-sm px-5 py-2.5 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.97] font-jakarta'

const variants: Record<Variant, string> = {
  green:
    'text-white shadow-[0_4px_15px_rgba(16,185,129,0.25)] hover:shadow-[0_0_28px_rgba(16,185,129,0.55)] hover:-translate-y-0.5 bg-[linear-gradient(135deg,var(--sp-green),var(--sp-green-glow))]',
  glass:
    'sp-glass text-sp-text hover:border-sp-green hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]',
  gold:
    'font-extrabold text-[#1A1200] shadow-[0_4px_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_28px_rgba(245,158,11,0.55)] hover:-translate-y-0.5 bg-[linear-gradient(135deg,var(--sp-yellow),var(--sp-yellow-glow))]',
  ghost: 'text-sp-text-muted hover:text-sp-text',
}

export function MarketingButton({
  children,
  variant = 'green',
  href,
  className = '',
  ...props
}: {
  children: ReactNode
  variant?: Variant
  href?: string
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `${base} ${variants[variant]} ${className}`

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  )
}
