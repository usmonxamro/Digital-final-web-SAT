'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { SiteStats } from '@/app/api/admin/stats/route'

/** Admin "Statistika": site visits (30 days, Tashkent days), users, attempts. */
export function StatsPanel() {
  const [stats, setStats] = useState<SiteStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Xatolik')
        setStats(d)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Xatolik'))
  }, [])

  if (error) return <p className="text-[13px] text-red-600">{error}</p>
  if (!stats) {
    return (
      <div className="flex items-center gap-2 py-6 text-[13px] text-ink-faint">
        <Loader2 size={15} className="animate-spin" /> Yuklanmoqda...
      </div>
    )
  }

  const { visits, users, attempts } = stats
  const max = Math.max(1, ...visits.daily.map((d) => d.views))
  const h = hover ?? visits.daily.length - 1
  const fmtDate = (s: string) => {
    const [, m, d] = s.split('-')
    return `${Number(d)}.${m}`
  }

  return (
    <div>
      {stats.migrationNeeded && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Tashriflar jadvali yo&apos;q — supabase/schema.sql oxiridagi v38 qismini ishga tushiring.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Bugun tashrif" value={visits.today} sub={`${visits.uniqueToday} ta odam`} />
        <Tile label="7 kun" value={visits.last7} sub={`${visits.unique7} ta odam`} />
        <Tile label="30 kun" value={visits.last30} sub={`${visits.unique30} ta odam`} />
        <Tile label="Foydalanuvchilar" value={users.total} sub={`+${users.new7} shu hafta · +${users.new30} 30 kun`} />
      </div>

      <div className="mt-5 rounded-xl border border-line bg-white p-4">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[13.5px] font-extrabold text-ink">Kunlik ko&apos;rishlar — oxirgi 30 kun</h3>
          <div className="text-[12px] text-ink-soft">
            <span className="font-bold text-ink">{fmtDate(visits.daily[h].date)}</span> · {visits.daily[h].views} ko&apos;rish ·{' '}
            {visits.daily[h].visitors} odam
          </div>
        </div>
        <div className="relative mt-3 h-[160px]" onMouseLeave={() => setHover(null)}>
          {/* recessive gridlines */}
          {[0.5, 1].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }}>
              <span className="absolute -top-2.5 left-0 bg-white pr-1 text-[10px] text-ink-faint">{Math.round(max * f)}</span>
            </div>
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px] pl-7">
            {visits.daily.map((d, i) => (
              <div
                key={d.date}
                className="flex h-full flex-1 cursor-default items-end"
                onMouseEnter={() => setHover(i)}
                title={`${fmtDate(d.date)}: ${d.views} ko'rish, ${d.visitors} odam`}
              >
                <div
                  className={`w-full rounded-t-[4px] transition-colors ${i === h ? 'bg-green-deep' : 'bg-green/70'}`}
                  style={{ height: `${Math.max(d.views ? 3 : 0, (d.views / max) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex justify-between pl-7 text-[10.5px] text-ink-faint">
          <span>{fmtDate(visits.daily[0].date)}</span>
          <span>{fmtDate(visits.daily[14].date)}</span>
          <span>Bugun</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-2 text-[13.5px] font-extrabold text-ink">Eng ko&apos;p ochilgan sahifalar (30 kun)</h3>
          {visits.topPages.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">Hali ma&apos;lumot yo&apos;q.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <tbody>
                {visits.topPages.map((p) => (
                  <tr key={p.path} className="border-t border-line first:border-t-0">
                    <td className="max-w-0 truncate py-1.5 pr-2 font-mono text-ink-soft">{p.path}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums text-ink">{p.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-2 text-[13.5px] font-extrabold text-ink">Mock natijalari</h3>
          <div className="text-[30px] font-black leading-none text-ink">{attempts.total}</div>
          <div className="mt-1 text-[12.5px] text-ink-faint">jami topshirilgan · shu hafta +{attempts.last7}</div>
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-1 text-[28px] font-black leading-none tabular-nums text-ink">{value.toLocaleString('ru-RU')}</div>
      <div className="mt-1.5 text-[11.5px] text-ink-soft">{sub}</div>
    </div>
  )
}
