'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'

export type MinutesKey = 'rw1' | 'rw2' | 'm1' | 'm2' | 'seq'
export type ModuleMinutes = Partial<Record<MinutesKey, number>>

export const DEFAULT_MODULE_MINUTES = 35

const LABELS: Record<MinutesKey, string> = {
  rw1: 'English 1-modul',
  rw2: 'English 2-modul',
  m1: 'Math 1-modul',
  m2: 'Math 2-modul',
  seq: 'Math (hammasi uchun jami vaqt)',
}

/** Starting values for a form: 35 minutes for every module (70 for one continuous Math block). */
export function defaultMinutes(keys: MinutesKey[]): ModuleMinutes {
  const out: ModuleMinutes = {}
  for (const k of keys) out[k] = k === 'seq' ? DEFAULT_MODULE_MINUTES * 2 : DEFAULT_MODULE_MINUTES
  return out
}

const clean = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 3)

/**
 * "Vaqt" block of the new-mock forms: one box for the same time in every module (default 35 min) AND one box per
 * module, both always visible. Typing in the common box fills all modules; each module can then be changed on its own.
 */
export function ModuleMinutesField({
  keys,
  value,
  onChange,
}: {
  keys: MinutesKey[]
  value: ModuleMinutes
  onChange: (v: ModuleMinutes) => void
}) {
  const perModule = keys.filter((k) => k !== 'seq')
  const [common, setCommon] = useState(String(DEFAULT_MODULE_MINUTES))

  function setAll(raw: string) {
    const t = clean(raw)
    setCommon(t)
    const n = Number(t)
    if (!n) return
    const next: ModuleMinutes = { ...value }
    for (const k of keys) next[k] = k === 'seq' ? n * 2 : n
    onChange(next)
  }
  function setOne(k: MinutesKey, raw: string) {
    const t = clean(raw)
    onChange({ ...value, [k]: t === '' ? undefined : Number(t) })
  }

  const input =
    'w-20 px-2.5 py-2 rounded-[9px] border border-line text-[13.5px] text-center font-bold focus:outline-none focus:border-green'

  return (
    <div className="mb-4 rounded-xl border border-line p-3.5">
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink-soft mb-2.5">
        <Clock size={14} /> Vaqt (daqiqa)
      </div>

      {perModule.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-line">
          <span className="text-[12.5px] text-ink-soft">Hamma modulga bir xil:</span>
          <input value={common} onChange={(e) => setAll(e.target.value)} inputMode="numeric" className={input} />
          <span className="text-[12px] text-ink-faint">daqiqa (standart: {DEFAULT_MODULE_MINUTES})</span>
        </div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-2.5">
        {keys.map((k) => (
          <label key={k} className="flex items-center gap-2 text-[12.5px] text-ink-soft">
            {LABELS[k]}
            <input
              value={value[k] ?? ''}
              onChange={(e) => setOne(k, e.target.value)}
              inputMode="numeric"
              className={input}
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        Har bir modul uchun alohida vaqtni o&apos;zingiz yozishingiz mumkin. Bo&apos;sh qoldirilsa, 35 daqiqa olinadi.
      </p>
    </div>
  )
}
