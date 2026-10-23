import { Landing } from '@/components/marketing/landing/landing'

/** Structured data: who we are, the site, and the FAQ — Google shows these as rich results and the brand panel. */
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'EducationalOrganization',
      '@id': 'https://satbyusmon.com/#org',
      name: 'SAT Akademiyasi',
      alternateName: ['SAT by Usmon', 'satbyusmon', 'SAT Akademiya', 'SAT Academy Uzbekistan'],
      url: 'https://satbyusmon.com',
      logo: 'https://satbyusmon.com/icon.svg',
      image: 'https://satbyusmon.com/og.png',
      description: "O'zbekistonda Digital SAT'ga tayyorlanish platformasi: SAT mock testlar, savollar banki, video tahlillar va Telegram kurslari.",
      founder: { '@type': 'Person', name: 'Usmon Xamroyev' },
      areaServed: { '@type': 'Country', name: 'Uzbekistan' },
      sameAs: ['https://t.me/SATAKADEMIYASI', 'https://t.me/SAT_surxon', 'https://t.me/Usmon_Xamroyev'],
      email: 'usmonxamro@gmail.com',
      knowsLanguage: ['uz', 'ru', 'en'],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://satbyusmon.com/#website',
      url: 'https://satbyusmon.com',
      name: 'SAT Akademiyasi',
      alternateName: 'satbyusmon.com',
      inLanguage: ['uz', 'ru', 'en'],
      publisher: { '@id': 'https://satbyusmon.com/#org' },
    },
    {
      '@type': 'Course',
      name: 'Digital SAT tayyorgarlik kursi',
      description: "SAT Math va Reading & Writing bo'yicha mock testlar, mavzulashtirilgan mashqlar va ustoz bilan Telegram kurslari.",
      provider: { '@id': 'https://satbyusmon.com/#org' },
      inLanguage: 'uz',
      offers: [
        { '@type': 'Offer', price: '0', priceCurrency: 'UZS', category: 'Free' },
        { '@type': 'Offer', price: '50000', priceCurrency: 'UZS', category: 'Subscription' },
      ],
      hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: 'PT10H' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        ['Platformadan foydalanish uchun to‘lov kerakmi?', 'Yo‘q, bepul rejada tanlangan mock testlar va namunaviy savollardan foydalanishingiz mumkin. To‘liq imkoniyatlar uchun PRO rejani tanlang.'],
        ['Mock testlar haqiqiy imtihonga o‘xshashmi?', 'Ha, testlar haqiqiy Digital SAT interfeysiga o‘xshash, aniq vaqt cheklovi va adaptiv modullar (Module 1 & 2) bilan ishlaydi.'],
        ['Darslar qaysi tilda?', 'Darslar o‘zbek tilida olib boriladi, savollar esa asl SAT formatida (inglizcha) beriladi.'],
        ['Mobil telefonda ham foydalanish mumkinmi?', 'Ha, platforma telefon, planshet va kompyuterda qulay ishlaydi.'],
      ].map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ],
}

export default function LandingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c') }} />
      <Landing />
    </>
  )
}
