'use client'

import { useRouter } from 'next/navigation'
import { ShieldCheck, LogOut, Crown } from 'lucide-react'
import { useUser } from '@/components/marketing/dashboard/user-context'

export default function ProfilePage() {
  const user = useUser()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <div>
      <div className="sp-glass rounded-2xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-xl text-white bg-[linear-gradient(135deg,var(--sp-green),var(--sp-green-glow))]">
            {user.firstName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-extrabold text-[19px] text-sp-text">
              {user.firstName} {user.lastName ?? ''}
            </div>
            <div className="text-[13.5px] text-sp-text-muted flex items-center gap-1.5 mt-0.5">
              {user.plan === 'premium' ? (
                <>
                  <Crown size={13} className="text-sp-yellow" /> Premium a&apos;zo
                </>
              ) : (
                'Bepul tarif'
              )}
            </div>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold bg-sp-input px-3 py-1.5 rounded-full text-sp-text-muted">
          <ShieldCheck size={14} /> Xavfsiz va shaxsiy
        </span>
      </div>

      <div className="mt-6 space-y-4 max-w-[640px]">
        {user.plan !== 'premium' && (
          <div className="sp-glass sp-hover-glow-gold rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3 border-sp-yellow/30">
            <div>
              <div className="font-bold text-[14.5px] text-sp-text flex items-center gap-1.5">
                <Crown size={15} className="text-sp-yellow" /> Premium&apos;ga o&apos;ting
              </div>
              <p className="text-[13px] text-sp-text-muted mt-1">
                Adaptiv modul, video darslar va batafsil tahlilga ega bo&apos;ling.
              </p>
            </div>
            <button className="px-4 py-2.5 rounded-lg text-[13.5px] font-extrabold text-[#1A1200] bg-[linear-gradient(135deg,var(--sp-yellow),var(--sp-yellow-glow))]">
              PRO&apos;ga o&apos;tish
            </button>
          </div>
        )}

        <div className="sp-glass rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-bold text-[14.5px] text-red-400 flex items-center gap-1.5">
              <LogOut size={15} /> Chiqish
            </div>
            <p className="text-[13px] text-sp-text-muted mt-1">Ushbu qurilmada hisobingizdan chiqing.</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2.5 rounded-lg text-[13.5px] font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10"
          >
            Chiqish
          </button>
        </div>
      </div>
    </div>
  )
}
