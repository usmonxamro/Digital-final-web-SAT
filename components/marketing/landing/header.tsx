import { Zap } from 'lucide-react'
import { Logo } from '@/components/marketing/logo'
import { MarketingButton } from '@/components/marketing/button'
import { ThemeToggle } from '@/components/marketing/theme-toggle'

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-sp-border bg-sp-header backdrop-blur-md font-jakarta">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-20">
        <Logo subtitle={false} />
        <nav className="hidden md:flex items-center gap-8 text-[14.5px] font-medium text-sp-text-muted">
          <a href="#imkoniyat" className="hover:text-sp-text transition-colors">Imkoniyatlar</a>
          <a href="#darslar" className="hover:text-sp-text transition-colors">Video darslar</a>
          <a href="#tarif" className="hover:text-sp-text transition-colors">Tariflar</a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <MarketingButton href="/login" variant="green">
            <Zap size={14} /> PRO Boshlash
          </MarketingButton>
        </div>
      </div>
    </header>
  )
}
