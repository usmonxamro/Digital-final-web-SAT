import { BrandMark } from '@/components/brand-mark'
import Link from 'next/link'

export function Logo({
  subtitle = true,
  size = 'md',
  href = '/',
  compact = false,
}: {
  subtitle?: boolean
  size?: 'sm' | 'md'
  href?: string
  /** Hide the wordmark on phones (header with several buttons). */
  compact?: boolean
}) {
  const text = size === 'sm' ? 'text-base' : 'text-lg'

  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0 font-jakarta">
      <BrandMark size={size === 'sm' ? 32 : 36} />
      <div className={`font-extrabold leading-tight text-sp-text ${text} ${compact ? 'hidden sm:block' : ''}`}>
        SAT <span className="font-semibold opacity-70">by</span> <span className="sbu-accent-text">Usmon</span>
        {subtitle && (
          <span className="block font-semibold text-[10.5px] tracking-wide text-sp-text-muted mt-0.5">
            Usmon Xamroyev bilan
          </span>
        )}
      </div>
    </Link>
  )
}
