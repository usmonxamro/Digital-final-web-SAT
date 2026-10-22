'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, Eye, EyeOff, GraduationCap, Lock, Mail, Phone, ShieldCheck, User } from 'lucide-react'
import Link from 'next/link'
import { safeNext } from '@/lib/safe-next'
import { useT } from '@/components/i18n-provider'
import { LangSwitch } from '@/components/lang-switch'

type Method = 'email' | 'phone'
type Mode = 'signin' | 'signup'

const ERRORS: Record<string, string> = {
  google_not_configured: "Google orqali kirish hali sozlanmagan.",
  google_denied: 'Google orqali kirish bekor qilindi.',
  google_state: "Google sessiyasi eskirgan. Qaytadan urinib ko'ring.",
  google_failed: "Google bilan kirib bo'lmadi. Qaytadan urinib ko'ring.",
  need_sql: "Bazada Google uchun ustunlar yo'q (supabase/schema.sql dagi v50 qismini ishga tushiring).",
  too_many: "Juda ko'p urinish. Keyinroq urinib ko'ring.",
  server: "Server xatosi. Keyinroq urinib ko'ring.",
}

function SignIn() {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState<Mode>('signin')
  const [method, setMethod] = useState<Method>('email')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [progress, setProgress] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const e = params.get('error')
    if (e) setError(t(ERRORS[e] ?? 'Xatolik yuz berdi.'))
    if (params.get('mode') === 'signup') setMode('signup')
  }, [params])

  function switchMode(m: Mode) {
    setError(null)
    setNotice(null)
    setMode(m)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)
    const id = method === 'email' ? { email } : { phone }
    const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
    const payload = mode === 'signup' ? { firstName, lastName, ...id, password } : { ...id, password }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(t(data.error ?? 'Xatolik yuz berdi.'))
        setLoading(false)
        return
      }
      setLoading(false)
      setSuccess(true)
      setTimeout(() => setProgress(true), 50)
      setTimeout(() => {
        router.push(safeNext(params.get('next')) ?? '/dashboard')
        router.refresh()
      }, 1300)
    } catch {
      setError(t("Server bilan bog'lanib bo'lmadi. Qaytadan urinib ko'ring."))
      setLoading(false)
    }
  }

  const tabOn =
    'py-2.5 text-xs font-medium rounded-lg transition-all duration-200 bg-orange-600 text-white shadow-sm flex items-center justify-center gap-2'
  const tabOff =
    'py-2.5 text-xs font-medium rounded-lg transition-all duration-200 text-slate-400 hover:text-white flex items-center justify-center gap-2'
  const inputCls =
    'w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none sat-input-glow transition-all'

  return (
    <div className="min-h-screen font-sans relative overflow-x-hidden flex items-center justify-center p-4 bg-[#070709] text-[#f8fafc]">
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-2 px-4 py-4 sm:px-8">
        <Link href="/" className="text-xs font-medium text-slate-400 hover:text-white transition-colors">{t('← Bosh sahifa')}</Link>
        <LangSwitch dark />
      </div>
      <div className="sat-signin-orb-1 pointer-events-none" />
      <div className="sat-signin-orb-2 pointer-events-none" />

      <div className="w-full max-w-[480px] relative z-10 my-12 sm:my-16">
        <div className="text-center mb-4 sm:mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 shadow-lg shadow-orange-600/30 mb-4 transform hover:scale-105 transition-transform duration-300">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-[1.35rem] font-bold tracking-tight text-white sm:text-3xl">SAT AKADEMIYASI</h1>
          <p className="text-sm text-slate-400 mt-1">{t('Digital SAT tayyorgarlik platformasi')}</p>
        </div>

        <div className="sat-glass-card rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden transition-all duration-500">
          {success && (
            <div
              className={`absolute inset-0 bg-[#0f0f14]/95 backdrop-blur-xl z-20 flex flex-col items-center justify-center p-8 text-center transition-opacity duration-500 ${
                progress ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="w-16 h-16 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-600/40 mb-4 animate-bounce">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t('Xush kelibsiz!')}</h3>
              <p className="text-sm text-slate-400 mb-6">{t('Dashboardga o‘tilmoqda...')}</p>
              <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-1000 ease-out"
                  style={{ width: progress ? '100%' : '0%' }}
                />
              </div>
            </div>
          )}

          {forgot ? (
            <ForgotPanel email={email} onBack={() => setForgot(false)} onDone={() => { setForgot(false); setNotice(t('Parol yangilandi. Yangi parol bilan kiring.')) }} />
          ) : (
          <>
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-xl font-semibold text-white">{mode === 'signin' ? t('Kirish') : t('Ro‘yxatdan o‘tish')}</h2>
            </div>
            <p className="text-xs text-slate-400">
              {mode === 'signin'
                ? t('Hisobingizga kirib, mashqni davom ettiring.')
                : t('Bepul hisob yarating va birinchi mockni ishlang.')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/80 rounded-xl mb-5 border border-white/5">
            <button type="button" onClick={() => setMethod('email')} className={method === 'email' ? tabOn : tabOff}>
              <Mail className="w-3.5 h-3.5" /> Email
            </button>
            <button type="button" onClick={() => setMethod('phone')} className={method === 'phone' ? tabOn : tabOff}>
              <Phone className="w-3.5 h-3.5" /> {t('Telefon')}
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3.5 sm:space-y-4">
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-300">{t('Ism')}</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Aziza"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-300">{t('Familiya')}</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Karimova"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            {method === 'email' ? (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">{t('Email manzil')}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="scholar@satakademiyasi.uz"
                    autoComplete="email"
                    className={inputCls}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-300">{t('Telefon raqam')}</label>
                <div className="relative flex">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    autoComplete="tel"
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-300">{t('Parol')}</label>
                {mode === 'signin' && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setError(null)
                      setNotice(null)
                      setForgot(true)
                    }}
                    className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    {t('Parolni unutdingizmi?')}
                  </a>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={mode === 'signup' ? 6 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full pl-10 pr-12 py-2.5 sm:py-3 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none sat-input-glow transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-orange-600 focus:ring-orange-500 focus:ring-offset-slate-900 cursor-pointer accent-orange-600"
                />
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">{t('Bu qurilmani eslab qolish')}</span>
              </label>
            </div>

            {error && (
              <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}
            {notice && (
              <p className="text-xs text-orange-200 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">{notice}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 sm:py-3.5 px-4 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-medium rounded-xl shadow-lg shadow-orange-600/30 hover:shadow-orange-600/50 transform active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <>
                  <span>{mode === 'signin' ? t('Kirish') : t('Ro‘yxatdan o‘tish')}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 sm:mt-6">
            <div className="relative flex py-1.5 items-center">
              <div className="flex-grow border-t border-slate-800" />
              <span className="flex-shrink mx-4 text-xs text-slate-500 uppercase tracking-widest">{t('yoki')}</span>
              <div className="flex-grow border-t border-slate-800" />
            </div>

            <div className="grid grid-cols-1 gap-3 mt-4">
              <a
                href={`/api/auth/google${safeNext(params.get('next')) ? `?next=${encodeURIComponent(safeNext(params.get('next'))!)}` : ''}`}
                className="flex items-center justify-center gap-3 py-3 sm:py-3.5 px-4 bg-white hover:bg-slate-100 border border-white rounded-xl text-sm font-semibold text-slate-900 shadow-lg shadow-black/30 transition-all duration-200"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                {t('Google bilan davom etish')}
              </a>
            </div>
          </div>

          <div className="mt-5 sm:mt-8 text-center">
            <p className="text-xs text-slate-400">
              {mode === 'signin' ? t('Hisobingiz yo‘qmi?') : t('Hisobingiz bormi?')}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setError(null)
                  setNotice(null)
                  setMode(mode === 'signin' ? 'signup' : 'signin')
                }}
                className="font-medium text-orange-400 hover:text-orange-300 transition-colors ml-1"
              >
                {mode === 'signin' ? t('Ro‘yxatdan o‘tish') : t('Kirish')}
              </a>
            </p>
          </div>
          </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-orange-500" /> {t('Ma’lumotlar himoyalangan')}
          </span>
          <span>•</span>
          <span>{t('Bluebook uslubida')}</span>
        </div>
      </div>
    </div>
  )
}

function ForgotPanel({ email: initial, onBack, onDone }: { email: string; onBack: () => void; onDone: () => void }) {
  const t = useT()
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState(initial)
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const cls =
    'w-full px-4 py-2.5 sm:py-3 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none sat-input-glow transition-all'

  async function call(url: string, body: object): Promise<boolean> {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(t(d.error ?? 'Xatolik yuz berdi.'))
        return false
      }
      return true
    } catch {
      setErr(t("Server bilan bog'lanib bo'lmadi."))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) {
      if (await call('/api/auth/forgot', { email })) setStep(2)
    } else if (await call('/api/auth/reset', { email, code, password: pw })) {
      onDone()
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-semibold text-white">{t('Parolni tiklash')}</h2>
      <p className="text-xs text-slate-400">
        {step === 1
          ? t('Ro‘yxatdan o‘tgan email manzilingizni kiriting — 6 xonali kodni yuboramiz.')
          : t('{email} manziliga kod yuborildi (spam papkasini ham tekshiring). Kodni va yangi parolni kiriting.', { email })}
      </p>
      {step === 1 ? (
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('Email manzil')} autoComplete="email" className={cls} />
      ) : (
        <>
          <input inputMode="numeric" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder={t('6 xonali kod')} className={`${cls} tracking-[0.4em] text-center text-lg`} />
          <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t('Yangi parol (kamida 6 belgi)')} autoComplete="new-password" className={cls} />
        </>
      )}
      {err && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
      <button type="submit" disabled={busy} className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-amber-500 text-white font-medium rounded-xl shadow-lg shadow-orange-600/30 disabled:opacity-70">
        {busy ? t('Kuting…') : step === 1 ? t('Kod yuborish') : t('Parolni yangilash')}
      </button>
      <p className="text-center text-[11px] text-slate-500">
        {t('Telefon bilan ro‘yxatdan o‘tgan bo‘lsangiz yoki email kelmasa, Telegramda @Usmon_Xamroyev ga yozing.')}
      </p>
      <button type="button" onClick={onBack} className="block mx-auto text-xs text-orange-400 hover:text-orange-300">
        {t('← Kirishga qaytish')}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <SignIn />
    </Suspense>
  )
}
