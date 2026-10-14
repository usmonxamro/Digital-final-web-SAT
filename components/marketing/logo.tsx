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
  const box = size === 'sm' ? 'w-8 h-8 rounded-[9px]' : 'w-9 h-9 rounded-[10px]'
  const text = size === 'sm' ? 'text-base' : 'text-lg'

  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0 font-jakarta">
      <div
        className={`${box} flex items-center justify-center shadow-[0_0_20px_-4px_var(--sp-green-glow)]`}
        style={{ background: 'linear-gradient(155deg, var(--sp-green-glow), var(--sp-green))' }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 3c5 0 8 3 8 8 0 6-5 10-8 10S4 17 4 11c0-5 3-8 8-8Z" />
          <path d="M12 3v18" />
        </svg>
      </div>
      <div className={`font-extrabold leading-tight text-sp-text ${text} ${compact ? 'hidden sm:block' : ''}`}>
        SAT AKADEMIYASI
        {subtitle && (
          <span className="block font-semibold text-[10.5px] tracking-wide text-sp-text-muted mt-0.5">
            Usmon Xamroyev bilan
          </span>
        )}
      </div>
    </Link>
  )
}
