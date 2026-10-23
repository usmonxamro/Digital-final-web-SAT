'use client'

import { memo, useEffect, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Calculator,
  Check,
  ChevronDown,
  Clock,
  FileDown,
  Flag,
  GraduationCap,
  Layers,
  Menu,
  MonitorPlay,
  Quote,
  Send,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  UserPlus,
  X,
} from 'lucide-react'
import './lx.css'
import { useI18n } from '@/components/i18n-provider'
import { LangSwitch } from '@/components/lang-switch'
import { ThemeSwitch } from '@/components/marketing/theme-switch'
import { L } from '@/components/marketing/landing/lx-i18n'
import type { Lang } from '@/lib/i18n'

const TG_COURSE = 'https://t.me/Usmon_Xamroyev'

/** The landing page: hero, how it works, features, real-exam section, courses, pricing, reviews, FAQ. */
function LandingImpl() {
  const { lang } = useI18n()
  // The older table keys were taken from HTML, so "&" there is "&amp;" — try both.
  const t = (s: string) => {
    const r = L(s, lang)
    if (lang === 'uz' || r !== s || !s.includes('&')) return r
    return L(s.replace(/&/g, '&amp;'), lang).replace(/&amp;/g, '&')
  }

  // Fade-in on scroll (content is visible without JS — the class is only added once the observer runs).
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.lx [data-rv]')
    if (!('IntersectionObserver' in window)) return
    document.documentElement.classList.add('lx-anim')
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) {
            e.target.classList.add('lx-in')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [lang])

  return (
    <div className="lx">
      <Header t={t} />
      <main>
        <Hero t={t} />
        <Stats t={t} />
        <Steps t={t} />
        <Features t={t} />
        <ExamSection t={t} />
        <Courses t={t} />
        <Pricing t={t} />
        <Reviews t={t} />
        <Faq t={t} />
        <FinalCta t={t} />
      </main>
      <Footer t={t} lang={lang} />
    </div>
  )
}

export const Landing = memo(LandingImpl)

type T = { t: (s: string) => string }

/* --------------------------------- header --------------------------------- */

function Header({ t }: T) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const links = [
    ['#features', t('Imkoniyatlar')],
    ['#courses', t('Kurslar')],
    ['#pricing', t('Narxlar')],
    ['#faq', t('Savollar')],
  ] as const
  return (
    <header className={`lx-head ${scrolled ? 'lx-scrolled' : ''}`}>
      <div className="lx-wrap lx-nav">
        <a href="#top" className="lx-logo" aria-label="SAT Akademiyasi">
          <LogoMark />
          <span>
            SAT <b>Akademiyasi</b>
          </span>
        </a>
        <nav className="lx-links">
          {links.map(([h, l]) => (
            <a key={h} href={h}>
              {l}
            </a>
          ))}
        </nav>
        <div className="lx-nav-r">
          <LangSwitch />
          <ThemeSwitch defaultTheme="light" />
          <a href="/login" className="lx-btn lx-btn-dark lx-hide-sm">
            {t('Kirish')}
          </a>
          <button className="lx-burger" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      <div className={`lx-sheet ${open ? 'lx-open' : ''}`} onClick={() => setOpen(false)}>
        {links.map(([h, l]) => (
          <a key={h} href={h}>
            {l} <ArrowRight />
          </a>
        ))}
        <a href="/login" className="lx-btn lx-btn-dark">
          {t('Kirish')}
        </a>
        <a href="/login?mode=signup" className="lx-btn lx-btn-primary">
          {t('Bepul boshlash')}
        </a>
      </div>
    </header>
  )
}

function LogoMark() {
  return (
    <svg className="lx-mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 2l18 10.5v23L24 46 6 35.5v-23z" fill="url(#lxg)" />
      <defs>
        <linearGradient id="lxg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a1a" />
          <stop offset="1" stopColor="#f43f5e" />
        </linearGradient>
      </defs>
      <path d="M24 14l11 5-11 5-11-5z" fill="#fff" />
      <path d="M17 22.5v6c0 2 3.5 4 7 4s7-2 7-4v-6l-7 3z" fill="#fff" opacity=".9" />
    </svg>
  )
}

/* ---------------------------------- hero ---------------------------------- */

function Hero({ t }: T) {
  return (
    <section className="lx-hero" id="top">
      <div className="lx-hero-bg" aria-hidden />
      <div className="lx-wrap lx-hero-grid">
        <div className="lx-hero-copy">
          <span className="lx-kicker">
            <Sparkles /> {t('Digital SAT · o‘zbek tilida tayyorgarlik')}
          </span>
          <h1>
            {t('SAT yo‘lingiz shu yerdan')} <em>{t('boshlanadi.')}</em>
          </h1>
          <p className="lx-lead">{t('Haqiqiy imtihonga o‘xshash mock testlar, mavzulashtirilgan mashqlar, video darslar va natijalaringiz tahlili — barchasi bir platformada.')}</p>
          <div className="lx-cta">
            <a href="/login?mode=signup" className="lx-btn lx-btn-primary lx-btn-lg">
              {t('Bepul boshlash')} <ArrowRight />
            </a>
            <a href="#features" className="lx-btn lx-btn-ghost lx-btn-lg">
              {t('Mocklarni ko‘rish')}
            </a>
          </div>
          <div className="lx-trust">
            <span className="lx-faces" aria-hidden>
              {['#fbbf24', '#fb7185', '#60a5fa', '#34d399'].map((c, i) => (
                <i key={c} style={{ background: c }}>
                  {['A', 'M', 'S', 'D'][i]}
                </i>
              ))}
            </span>
            <span>
              <b>1000+</b> {t('o‘quvchi biz bilan tayyorlanmoqda')}
            </span>
          </div>
        </div>

        <div className="lx-hero-visual" aria-hidden>
          <div className="lx-exam">
            <div className="lx-exam-top">
              <span>
                <b>Section 2, Module 1</b>
                <small>Math</small>
              </span>
              <span className="lx-timer">
                <Clock /> 28:41
              </span>
              <span className="lx-exam-spacer" />
            </div>
            <div className="lx-exam-body">
              <div className="lx-qnum">
                <b>12</b>
                <span>
                  <Flag /> Mark for Review
                </span>
                <span className="lx-exam-tools">
                  <Calculator /> Desmos
                </span>
              </div>
              <p>
                If <i>5x − 7 = 3x + 9</i>, what is the value of <i>x</i>?
              </p>
              {['4', '8', '12', '16'].map((v, i) => (
                <div key={v} className={`lx-opt ${i === 1 ? 'lx-sel' : ''}`}>
                  <span>{'ABCD'[i]}</span> {v}
                </div>
              ))}
            </div>
            <div className="lx-exam-foot">
              <span>Question 12 of 22</span>
              <span className="lx-next">Next →</span>
            </div>
          </div>
          <div className="lx-float lx-float-score">
            <small>{t('Taxminiy ball')}</small>
            <b>1460</b>
            <span>
              <TrendingUp /> +280
            </span>
          </div>
          <div className="lx-float lx-float-ok">
            <Check /> {t('Javobingiz saqlandi')}
          </div>
          <div className="lx-float lx-float-teacher">
            <GraduationCap />
            <span>
              <small>{t('Ustoz natijasi')}</small>
              <b>SAT Math 800/800</b>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- stats ---------------------------------- */

function Stats({ t }: T) {
  const items = [
    ['1000+', t('Faol o‘quvchilar')],
    ['800/800', t('Ustozning SAT Math natijasi')],
    ['10 000+', t('Yechilgan testlar')],
    ['4.9/5', t('O‘quvchilar bahosi')],
  ]
  return (
    <section className="lx-stats-sec">
      <div className="lx-wrap lx-stats" data-rv>
        {items.map(([n, l]) => (
          <div key={l} className="lx-stat">
            <b>{n}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* --------------------------------- steps ---------------------------------- */

function Steps({ t }: T) {
  const steps = [
    [UserPlus, t('Ro‘yxatdan o‘ting'), t('Bir daqiqada bepul akkaunt oching — karta talab qilinmaydi.')],
    [MonitorPlay, t('Mock yeching'), t('Haqiqiy imtihondagidek: 2 modul, taymer, Desmos kalkulyatori.')],
    [BarChart3, t('Tahlil qilib o‘sing'), t('Ball, xatolar va zaif mavzular — keyingi qadam aniq bo‘ladi.')],
  ] as const
  return (
    <section className="lx-sec">
      <div className="lx-wrap">
        <SecHead kicker={t('Qanday ishlaydi')} title={t('Uch qadamda natijaga')} />
        <ol className="lx-steps">
          {steps.map(([Icon, title, text], i) => (
            <li key={title} data-rv style={{ ['--d' as string]: `${i * 90}ms` }}>
              <span className="lx-step-n">{i + 1}</span>
              <span className="lx-step-ico">
                <Icon />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function SecHead({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <div className="lx-sec-head" data-rv>
      <span className="lx-eyebrow">{kicker}</span>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  )
}

/* -------------------------------- features -------------------------------- */

function Features({ t }: T) {
  return (
    <section className="lx-sec lx-sec-tint" id="features">
      <div className="lx-wrap">
        <SecHead
          kicker={t('Imkoniyatlar')}
          title={t('Bitta platforma — butun tayyorgarlik')}
          text={t('Maqsadingizga erishish uchun kerak bo‘ladigan zamonaviy vositalar, interaktiv mashqlar va real tajribaga yaqin imtihon muhiti.')}
        />
        <div className="lx-bento">
          <article className="lx-card lx-card-big" data-rv>
            <span className="lx-ico lx-ico-orange">
              <MonitorPlay />
            </span>
            <h3>{t('Real mock testlar')}</h3>
            <p>{t('Haqiqiy Digital SAT interfeysi, 2 ta adaptiv modul, aniq taymer va ichki Desmos kalkulyatori.')}</p>
            <div className="lx-mods" aria-hidden>
              {[
                ['Reading & Writing · Module 1', '27', '32:00'],
                ['Reading & Writing · Module 2', '27', '32:00'],
                ['Math · Module 1', '22', '35:00'],
                ['Math · Module 2', '22', '35:00'],
              ].map(([n, q, m]) => (
                <div key={n}>
                  <span>{n}</span>
                  <small>{q} Q</small>
                  <b>{m}</b>
                </div>
              ))}
            </div>
          </article>
          <article className="lx-card" data-rv>
            <span className="lx-ico lx-ico-violet">
              <Layers />
            </span>
            <h3>{t('Savollar banki')}</h3>
            <p>{t('Mavzu va qiyinlik bo‘yicha mashq, har javobdan keyin yechim.')}</p>
            <div className="lx-tags" aria-hidden>
              <span>Algebra</span>
              <span>Advanced Math</span>
              <span>Data Analysis</span>
              <span>Geometry</span>
            </div>
          </article>
          <article className="lx-card" data-rv>
            <span className="lx-ico lx-ico-green">
              <BarChart3 />
            </span>
            <h3>{t('Natijalar tahlili')}</h3>
            <p>{t('Ball dinamikasi, to‘g‘ri/xato javoblar va zaif mavzular.')}</p>
            <div className="lx-bars" aria-hidden>
              {[38, 52, 47, 64, 72, 86].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </article>
          <article className="lx-card" data-rv>
            <span className="lx-ico lx-ico-rose">
              <MonitorPlay />
            </span>
            <h3>{t('Video tahlillar')}</h3>
            <p>{t('Mocklar bo‘yicha ustozning video yechimlari.')}</p>
          </article>
          <article className="lx-card" data-rv>
            <span className="lx-ico lx-ico-sky">
              <Bot />
            </span>
            <h3>{t('Telegram bot')}</h3>
            <p>{t('Testni Telegram’da ham yeching — natija bir zumda.')}</p>
          </article>
          <article className="lx-card" data-rv>
            <span className="lx-ico lx-ico-amber">
              <FileDown />
            </span>
            <h3>{t('PDF yuklab olish')}</h3>
            <p>{t('Mockni chiroyli PDF qilib saqlang va qog‘ozda ishlang.')}</p>
          </article>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------ exam section ------------------------------ */

function ExamSection({ t }: T) {
  const points = [
    t('Adaptiv modullar (Module 1 & 2)'),
    t('Aniq taymer va belgilash (Mark for Review)'),
    t('Ichki Desmos kalkulyatori va formula varag‘i'),
    t('400–1600 shkalada ball va batafsil tahlil'),
  ]
  return (
    <section className="lx-sec">
      <div className="lx-wrap lx-split">
        <div data-rv>
          <span className="lx-eyebrow">{t('Haqiqiy imtihon muhiti')}</span>
          <h2 className="lx-h2-left">{t('Imtihon kuni hech narsa notanish bo‘lmaydi')}</h2>
          <p className="lx-muted">{t('Mocklar Digital SAT formatida: bir xil interfeys, vaqt, modullar va kalkulyator. Imtihonga borganingizda o‘zingizni uydagidek his qilasiz.')}</p>
          <ul className="lx-checks">
            {points.map((p) => (
              <li key={p}>
                <Check /> {p}
              </li>
            ))}
          </ul>
          <div className="lx-chip-row">
            <span>
              <Smartphone /> {t('Telefonda ham qulay')}
            </span>
          </div>
        </div>
        <div className="lx-rw" data-rv aria-hidden>
          <div className="lx-rw-top">
            <span>
              <b>Reading and Writing</b>
              <small>Module 1</small>
            </span>
            <span className="lx-timer">
              <Clock /> 32:15
            </span>
          </div>
          <div className="lx-rw-body">
            <div className="lx-rw-passage">
              Many cities around the world are reconsidering the role of public transportation in reducing urban congestion. Studies suggest that expanded transit systems can
              significantly decrease the number of private vehicles on the road.
            </div>
            <div className="lx-rw-q">
              <small>Question 7 of 27</small>
              <p>The passage primarily discusses…</p>
              {['a historical event', 'a scientific process', 'a policy question', 'a personal story'].map((v, i) => (
                <div key={v} className={`lx-opt ${i === 2 ? 'lx-sel' : ''}`}>
                  <span>{'ABCD'[i]}</span> {v}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- courses -------------------------------- */

function Courses({ t }: T) {
  const courses = [
    {
      badge: t('🔥 Yaqinlashmoqda'),
      title: 'SAT November 800/800',
      text: t('Noyabr imtihoniga maqsadli va tizimli tayyorgarlik Telegram guruhida.'),
      items: [t('12 haftalik bosqichma-bosqich reja'), t('Video va yozma darslar'), t('Uy vazifalari va tahlil'), t('Real mock testlar va muhokamalar'), t('Ustoz va mentorlar bilan doimiy aloqa')],
      tone: 'orange',
    },
    {
      badge: t('❄ Qabul ochiq'),
      title: 'SAT December 800/800',
      text: t('Dekabr imtihoniga mo‘ljallangan intensiv kurs Telegramda — eng yaxshi natija uchun.'),
      items: [t('10 haftalik intensiv dastur'), t('Daily video darslar va qisqa konspektlar'), t('Amaliy mashqlar va testlar'), t('Shaxsiy progress tahlili'), t('Faol hamjamiyat va motivatsion muhit')],
      tone: 'blue',
    },
  ]
  return (
    <section className="lx-sec lx-sec-dark" id="courses">
      <div className="lx-wrap">
        <SecHead kicker={t('Telegram kurslari')} title={t('Ustoz bilan, reja asosida — Telegramda')} text={t('Tajribli ustozlar, aniq reja va amaliy darslar bilan maqsadingiz sari birga harakat qilamiz.')} />
        <div className="lx-courses">
          {courses.map((c) => (
            <article key={c.title} className={`lx-course lx-${c.tone}`} data-rv>
              <span className="lx-course-badge">{c.badge}</span>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <ul>
                {c.items.map((x) => (
                  <li key={x}>
                    <Check /> {x}
                  </li>
                ))}
              </ul>
              <a href={TG_COURSE} target="_blank" rel="noopener" className="lx-btn lx-btn-light">
                <Send /> {t('Batafsil ko‘rish')}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- pricing -------------------------------- */

function Pricing({ t }: T) {
  const free = [t('Tanlangan mock testlar'), t('Namunaviy savollar'), t('Adaptiv modullar (Module 1 & 2)'), t('Telegram guruhidagi umumiy yangiliklar')]
  const pro = [t('Barcha mock testlar'), t('To‘liq video darslar'), t('Question bank (barcha mavzular)'), t('Ustozlar bilan savol-javob'), t('Telegram kurslariga to‘liq kirish'), t('Maxsus materiallar va imtihon strategiyalari')]
  return (
    <section className="lx-sec" id="pricing">
      <div className="lx-wrap">
        <SecHead kicker={t('Narxlar va rejalar')} title={t('O‘zingiz uchun rejani tanlang')} />
        <div className="lx-plans">
          <article className="lx-plan" data-rv>
            <h3>{t('Bepul reja')}</h3>
            <div className="lx-price">
              <b>0</b> {t('so‘m')} <small>{t('/ oy')}</small>
            </div>
            <ul>
              {free.map((x) => (
                <li key={x}>
                  <Check /> {x}
                </li>
              ))}
            </ul>
            <a href="/login?mode=signup" className="lx-btn lx-btn-ghost lx-block">
              {t('Bepul boshlash')}
            </a>
          </article>
          <article className="lx-plan lx-plan-pro" data-rv>
            <span className="lx-plan-tag">
              <Star /> {t('Eng mashhur')}
            </span>
            <h3>{t('PRO reja')}</h3>
            <div className="lx-price">
              <b>50 000</b> {t('so‘m')} <small>{t('/ oy')}</small>
            </div>
            <ul>
              {pro.map((x) => (
                <li key={x}>
                  <Check /> {x}
                </li>
              ))}
            </ul>
            <a href="/login?mode=signup" className="lx-btn lx-btn-primary lx-block">
              {t('PRO ga o‘tish')} <ArrowRight />
            </a>
          </article>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- reviews -------------------------------- */

function Reviews({ t }: T) {
  const list = [
    ['Azizabek', '1460 / 1600', '+280', t('“Bu platforma menga SAT ga tizimli tayyorlanishda katta yordam berdi. Mock testlar juda real va savollar haqiqiy imtihonga juda o‘xshash. 3 oyda 1180 dan 1460 ga chiqdim!”')],
    ['Mavjuda', '1520 / 1600', '+300', t('“Video darslar tushunarli va juda sifatli. O‘qituvchilarning izohlari murakkab mavzularni ham oson tushunishga yordam berdi.')],
    ['Sardor', '1490 / 1600', '+320', t('“Question bank va adaptive mock testlar mening eng sevimli qismlarim. Natijalarni tahlil qilish funksiyasi kuchli tomonlarim va ustida ishlashim kerak bo‘lgan joylarni aniq ko‘rsatib beradi.”')],
  ]
  return (
    <section className="lx-sec lx-sec-tint">
      <div className="lx-wrap">
        <SecHead kicker={t('O‘quvchilar fikri')} title={t('Biz bilan natijaga erishgan o‘quvchilar')} />
        <div className="lx-reviews">
          {list.map(([name, score, plus, text]) => (
            <figure key={name} className="lx-review" data-rv>
              <Quote className="lx-q" />
              <blockquote>{text.replace(/^“|”$/g, '')}</blockquote>
              <figcaption>
                <span className="lx-av">{name[0]}</span>
                <span>
                  <b>{name}</b>
                  <small>{score}</small>
                </span>
                <em>
                  <TrendingUp /> {plus}
                </em>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------- FAQ ---------------------------------- */

const FAQ = [
  ['Platformadan foydalanish uchun to‘lov kerakmi?', 'Yo‘q, bepul rejada tanlangan mock testlar va namunaviy savollardan foydalanishingiz mumkin. To‘liq imkoniyatlar uchun PRO rejani tanlang.'],
  ['Mock testlar haqiqiy imtihonga o‘xshashmi?', 'Ha, testlar Bluebook interfeysiga o‘xshash, aniq vaqt cheklovi va adaptiv modullar (Module 1 & 2) bilan ishlaydi.'],
  ['Kurslar qanday tuzilgan?', 'Kurslar Telegram guruhida bosqichma-bosqich reja asosida o‘tiladi: video va yozma darslar, uy vazifalari, mock testlar va tahlil.'],
  ['Natijalarimni qanday tahlil qilishim mumkin?', 'Har bir testdan so‘ng batafsil tahlil olasiz: mavzular bo‘yicha natijalar, zaif joylar va tavsiyalar.'],
  ['Darslar qaysi tilda?', 'Darslar o‘zbek tilida olib boriladi, savollar esa asl SAT formatida (inglizcha) beriladi.'],
  ['Mobil telefonda ham foydalanish mumkinmi?', 'Ha, platforma telefon, planshet va kompyuterda qulay ishlaydi.'],
  ['To‘lov usullari qanday?', 'To‘lovni mahalliy to‘lov tizimlari va bank kartalari orqali amalga oshirishingiz mumkin.'],
  ['Agar savolimga javob topa olmasam-chi?', 'Telegram orqali bizga yozing yoki PRO rejada ustozlarga savol bering — tez orada javob beramiz.'],
]

function Faq({ t }: T) {
  return (
    <section className="lx-sec" id="faq">
      <div className="lx-wrap lx-faq-wrap">
        <SecHead kicker={t('Ko‘p beriladigan savollar')} title={t('Tez-tez so‘raladigan savollar')} />
        <div className="lx-faq">
          {FAQ.map(([q, a]) => (
            <details key={q} data-rv>
              <summary>
                {t(q)} <ChevronDown />
              </summary>
              <p>{t(a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------- final CTA ------------------------------- */

function FinalCta({ t }: T) {
  return (
    <section className="lx-sec">
      <div className="lx-wrap">
        <div className="lx-final" data-rv>
          <div>
            <h2>{t('SAT orzularingiz bir qadam yaqinroq!')}</h2>
            <p>{t('Bugun ro‘yxatdan o‘ting va sifatli darslar, real mock testlar hamda shaxsiy o‘sish trackingi bilan SAT yo‘lingizni boshlang.')}</p>
          </div>
          <div className="lx-final-btns">
            <a href="/login?mode=signup" className="lx-btn lx-btn-light lx-btn-lg">
              {t('Bepul boshlash')} <ArrowRight />
            </a>
            <a href={TG_COURSE} target="_blank" rel="noopener" className="lx-btn lx-btn-outline-light lx-btn-lg">
              <Send /> {t('Telegram kurslariga qo‘shilish')}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- footer --------------------------------- */

const ABOUT: Record<Lang, string> = {
  uz: 'SAT Akademiyasi (satbyusmon.com, «SAT by Usmon») — O‘zbekistonda Digital SAT imtihoniga tayyorlanish platformasi. Bu yerda bepul SAT mock testlar, SAT Math va Reading & Writing mashqlari, o‘tgan yillar imtihonlari (Past Exams), savollar banki, video tahlillar va o‘zbek tilidagi Telegram kurslari bor. Toshkent, Termiz, Samarqand va butun O‘zbekistondan o‘quvchilar onlayn tayyorlanadi.',
  ru: 'SAT Akademiyasi (satbyusmon.com, «SAT by Usmon») — платформа подготовки к Digital SAT в Узбекистане: бесплатные пробные тесты SAT, задания по SAT Math и Reading & Writing, прошлые экзамены, банк вопросов, видеоразборы и Telegram-курсы на узбекском языке. Ученики из Ташкента, Термеза, Самарканда и всего Узбекистана готовятся онлайн.',
  en: 'SAT Akademiyasi (satbyusmon.com, “SAT by Usmon”) is a Digital SAT prep platform in Uzbekistan: free SAT mock tests, SAT Math and Reading & Writing practice, past exams, a question bank, video walkthroughs and Telegram courses taught in Uzbek. Students from Tashkent, Termez, Samarkand and all over Uzbekistan prepare online.',
}

function Footer({ t, lang }: T & { lang: Lang }) {
  return (
    <footer className="lx-foot">
      <div className="lx-wrap">
        <div className="lx-foot-grid">
          <div className="lx-foot-brand">
            <a href="#top" className="lx-logo">
              <LogoMark />
              <span>
                SAT <b>Akademiyasi</b>
              </span>
            </a>
            <p>{t('Haqiqiy imtihonga o‘xshash mock testlar, mavzulashtirilgan darslar va analitika bilan SAT yo‘lingizda ishonchli hamroh.')}</p>
            <a href="https://t.me/SATAKADEMIYASI" target="_blank" rel="noopener" className="lx-tg">
              <Send /> @SATAKADEMIYASI
            </a>
          </div>
          <div>
            <h4>{t('Mahsulot')}</h4>
            <a href="#features">{t('Imkoniyatlar')}</a>
            <a href="#courses">{t('Kurslar')}</a>
            <a href="#pricing">{t('Narxlar')}</a>
            <a href="/login">{t('Kirish')}</a>
          </div>
          <div>
            <h4>{t('Yordam')}</h4>
            <a href="#faq">FAQ</a>
            <a href="https://t.me/Usmon_Xamroyev" target="_blank" rel="noopener">
              @Usmon_Xamroyev
            </a>
            <a href="https://t.me/SAT_surxon" target="_blank" rel="noopener">
              @SAT_surxon
            </a>
            <a href="mailto:usmonxamro@gmail.com">usmonxamro@gmail.com</a>
          </div>
        </div>
        <div className="lx-about">
          <h4>{t('SAT Akademiyasi (satbyusmon.com) haqida')}</h4>
          <p>{ABOUT[lang]}</p>
        </div>
        <div className="lx-copy">
          <span>© 2026 SAT Akademiyasi · satbyusmon.com</span>
          <span>{t('Bilim orqali katta imkoniyatlar.')}</span>
        </div>
      </div>
    </footer>
  )
}
