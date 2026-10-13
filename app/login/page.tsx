'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, Eye, EyeOff, GraduationCap, Lock, Mail, Phone, ShieldCheck, User } from 'lucide-react'

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

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const e = params.get('error')
    if (e) setError(ERRORS[e] ?? 'Xatolik yuz berdi.')
  }, [params])

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
        setError(data.error ?? 'Xatolik yuz berdi.')
        setLoading(false)
        return
      }
      setLoading(false)
      setSuccess(true)
      setTimeout(() => setProgress(true), 50)
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1300)
    } catch {
      setError("Server bilan bog'lanib bo'lmadi. Qaytadan urinib ko'ring.")
      setLoading(false)
    }
  }

  const tabOn =
    'py-2.5 text-xs font-medium rounded-lg transition-all duration-200 bg-orange-600 text-white shadow-sm flex items-center justify-center gap-2'
  const tabOff =
    'py-2.5 text-xs font-medium rounded-lg transition-all duration-200 text-slate-400 hover:text-white flex items-center justify-center gap-2'
  const inputCls =
    'w-full pl-10 pr-4 py-3 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none sat-input-glow transition-all'

  return (
    <div className="min-h-screen font-sans relative overflow-x-hidden flex items-center justify-center p-4 bg-[#070709] text-[#f8fafc]">
      <div className="sat-signin-orb-1 pointer-events-none" />
      <div className="sat-signin-orb-2 pointer-events-none" />

      <div className="sat-signin-scale w-full max-w-md relative z-10 my-4">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 shadow-lg shadow-orange-600/30 mb-4 transform hover:scale-105 transition-transform duration-300">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">SAT AKADEMIYASI</h1>
          <p className="text-sm text-slate-400 mt-1">Next-Generation Digital SAT Preparation</p>
        </div>

        <div className="sat-glass-card rounded-3xl p-8 shadow-2xl relative overflow-hidden transition-all duration-500">
          {success && (
            <div
              className={`absolute inset-0 bg-[#0f0f14]/95 backdrop-blur-xl z-20 flex flex-col items-center justify-center p-8 text-center transition-opacity duration-500 ${
                progress ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="w-16 h-16 bg-gradient-to-tr from-orange-600 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-600/40 mb-4 animate-bounce">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Welcome Back, Scholar!</h3>
              <p className="text-sm text-slate-400 mb-6">Redirecting to your digital test dashboard...</p>
              <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-1000 ease-out"
                  style={{ width: progress ? '100%' : '0%' }}
                />
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-white">{mode === 'signin' ? 'Sign In' : 'Create Account'}</h2>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Digital Portal
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {mode === 'signin'
                ? 'Enter your credentials to access your adaptive practice tests.'
                : 'Create your free account to start your adaptive practice tests.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/80 rounded-xl mb-6 border border-white/5">
            <button type="button" onClick={() => setMethod('email')} className={method === 'email' ? tabOn : tabOff}>
              <Mail className="w-3.5 h-3.5" /> Email
            </button>
            <button type="button" onClick={() => setMethod('phone')} className={method === 'phone' ? tabOn : tabOff}>
              <Phone className="w-3.5 h-3.5" /> Phone
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-300">First Name</label>
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
                  <label className="block text-xs font-medium text-slate-300">Last Name</label>
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
                <label className="block text-xs font-medium text-slate-300">Email Address</label>
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
                <label className="block text-xs font-medium text-slate-300">Phone Number</label>
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
                <label className="block text-xs font-medium text-slate-300">Password</label>
                {mode === 'signin' && (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setNotice("Parolni tiklash uchun administrator bilan bog'laning yoki Google orqali kiring.")
                    }}
                    className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    Forgot password?
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
                  className="w-full pl-10 pr-12 py-3 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none sat-input-glow transition-all"
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
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Remember this device</span>
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
              className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-medium rounded-xl shadow-lg shadow-orange-600/30 hover:shadow-orange-600/50 transform active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70"
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
                  <span>{mode === 'signin' ? 'Launch Practice Portal' : 'Create My Account'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800" />
              <span className="flex-shrink mx-4 text-xs text-slate-500 uppercase tracking-widest">Or continue with</span>
              <div className="flex-grow border-t border-slate-800" />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <a
                href="/api/auth/google"
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-medium text-slate-300 transition-all duration-200"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Google
              </a>
              <button
                type="button"
                onClick={() => setNotice('Apple ID orqali kirish tez orada qo‘shiladi. Hozircha Google yoki email/telefon bilan kiring.')}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-medium text-slate-300 transition-all duration-200"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.35c.67-.82 1.12-1.96.99-3.1-1.01.04-2.22.68-2.92 1.49-.62.72-1.16 1.88-1 2.99 1.13.09 2.27-.58 2.93-1.38z" />
                </svg>
                Apple ID
              </button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400">
              {mode === 'signin' ? "Don't have an account yet?" : 'Already have an account?'}
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
                {mode === 'signin' ? 'Create free account' : 'Sign in'}
              </a>
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-orange-500" /> 256-Bit SSL Secure
          </span>
          <span>•</span>
          <span>Bluebook™ Compatible</span>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <SignIn />
    </Suspense>
  )
}
