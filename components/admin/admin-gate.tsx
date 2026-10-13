'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'

type SessionState = {
  loggedIn: boolean
  isAdmin: boolean
  unlocked: boolean
  isOwner?: boolean
  codeConfigured?: boolean
}

/**
 * Wraps the admin panel: a non-admin sees a plain "page not found"; an admin
 * must type the access code (ADMIN_ACCESS_CODE) before the panel renders.
 * Every admin API checks the same code cookie on the server, so this screen
 * is not just cosmetic.
 */
export function AdminGate({ children }: { children: (info: { isOwner: boolean; lock: () => void }) => React.ReactNode }) {
  const [state, setState] = useState<SessionState | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The code is asked on EVERY visit to the panel (page load), even if the
  // browser still holds an unlocked cookie from earlier.
  const [enteredThisVisit, setEnteredThisVisit] = useState(false)

  function refresh() {
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ loggedIn: false, isAdmin: false, unlocked: false }))
  }
  useEffect(refresh, [])

  async function unlock(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error ?? "Kod noto'g'ri.")
        return
      }
      setCode('')
      setEnteredThisVisit(true)
      refresh()
    } catch {
      setError("Server bilan bog'lanib bo'lmadi.")
    } finally {
      setBusy(false)
    }
  }

  async function lock() {
    await fetch('/api/admin/unlock', { method: 'DELETE' }).catch(() => {})
    setEnteredThisVisit(false)
    refresh()
  }

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-ink-faint">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  if (!state.loggedIn || !state.isAdmin) {
    // Deliberately indistinguishable from a missing page.
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-white text-center">
        <div className="text-[44px] font-black text-ink">404</div>
        <div className="text-[14px] text-ink-faint">Sahifa topilmadi.</div>
        {!state.loggedIn && (
          <a href="/login" className="mt-3 text-[12px] font-semibold text-ink-faint underline">
            Kirish
          </a>
        )}
      </div>
    )
  }

  const needsCode = !state.unlocked || (!enteredThisVisit && state.codeConfigured !== false)
  if (needsCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e7f3f1,#f8fafc_60%)] px-4">
        <form onSubmit={unlock} className="w-full max-w-[360px] rounded-2xl border border-line bg-white p-6 shadow-xl">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-green-mist text-green-deep">
            <KeyRound size={22} />
          </div>
          <h1 className="text-[18px] font-extrabold text-ink">Boshqaruv paneli</h1>
          <p className="mt-1 text-[12.5px] text-ink-faint">Davom etish uchun admin kodini kiriting.</p>
          <input
            type="password"
            autoFocus
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Admin kodi"
            className="mt-4 w-full rounded-[10px] border border-line px-3.5 py-2.5 text-[14px] tracking-widest focus:border-green focus:outline-none"
          />
          {error && <div className="mt-2 text-[12px] font-semibold text-red-600">{error}</div>}
          {state.codeConfigured === false && (
            <div className="mt-2 text-[11.5px] text-amber-700">
              Serverda ADMIN_ACCESS_CODE hali o&apos;rnatilmagan.
            </div>
          )}
          <button
            type="submit"
            disabled={!code || busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(135deg,var(--green-deep),var(--green)_65%,var(--green-bright))] py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Kirish
          </button>
          <p className="mt-3 text-center text-[11px] text-ink-faint">Panelga har kirganda kod so'raladi. 5 ta xato urinishdan keyin 15 daqiqa blok.</p>
        </form>
      </div>
    )
  }

  return <>{children({ isOwner: !!state.isOwner, lock })}</>
}
