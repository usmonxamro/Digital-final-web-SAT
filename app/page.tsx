import { LandingHeader } from '@/components/marketing/landing/header'
import { Hero } from '@/components/marketing/landing/hero'
import { DemoLessons } from '@/components/marketing/landing/demo-lessons'
import { BookSection } from '@/components/marketing/landing/book-section'
import { Features } from '@/components/marketing/landing/features'
import { Pricing } from '@/components/marketing/landing/pricing'
import { LandingFooter } from '@/components/marketing/landing/footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-sp-bg transition-colors">
      <LandingHeader />
      <main>
        <Hero />
        <DemoLessons />
        <BookSection />
        <Features />
        <Pricing />
      </main>
      <LandingFooter />
    </div>
  )
}
