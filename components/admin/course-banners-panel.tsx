'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Archive, ArchiveRestore, ChevronDown, Eye, EyeOff, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import type { CourseGroup } from '@/lib/course-groups'
import { setCourseGroupsCache } from '@/components/use-course-groups'

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

/**
 * Admin «Kurs bannerlari»: the Telegram course groups and their banners (cards) on the landing page and in
 * «Mening kurslarim». Add a group for a new intake, hide a finished one, or archive it — no code changes.
 */
export function CourseBannersPanel() {
  const [groups, setGroups] = useState<CourseGroup[] | null>(null)
  const [saved, setSaved] = useState<string>('')
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [isNew, setIsNew] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/course-groups')
      .then((r) => r.json())
      .then((d) => {
        const g = (d?.groups ?? []) as CourseGroup[]
        setGroups(g)
        setSaved(JSON.stringify(g))
      })
      .catch(() => setGroups([]))
  }, [])

  if (!groups) {
    return (
      <div className="flex items-center gap-2 py-6 text-[13px] text-ink-faint">
        <Loader2 size={15} className="animate-spin" /> Yuklanmoqda...
      </div>
    )
  }

  const dirty = JSON.stringify(groups) !== saved
  const patch = (slug: string, p: Partial<CourseGroup>) => setGroups((gs) => gs!.map((g) => (g.slug === slug ? { ...g, ...p } : g)))

  function add() {
    const base = 'yangi-guruh'
    let slug = base
    for (let i = 2; groups!.some((g) => g.slug === slug); i++) slug = `${base}-${i}`
    const g: CourseGroup = {
      slug,
      title: 'SAT March 800/800',
      short: 'Mart',
      theme: groups!.length % 2 === 0 ? 'nov' : 'dec',
      month: 'MARCH',
      tag: '🔥 Qabul ochiq',
      desc: 'Imtihonga maqsadli va tizimli tayyorgarlik Telegram guruhida.',
      bullets: ['Bosqichma-bosqich reja', 'Video va yozma darslar', 'Uy vazifalari va tahlil', 'Real mock testlar'],
      link: 'https://t.me/Usmon_Xamroyev',
      landing: true,
      dashboard: true,
    }
    setGroups([...groups!, g])
    setIsNew((s) => new Set(s).add(slug))
    setOpenSlug(slug)
  }

  async function save() {
    setBusy(true)
    setMsg(null)
    const res = await fetch('/api/admin/course-groups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (!res?.ok) return setMsg({ ok: false, text: d?.error ?? 'Saqlab bo‘lmadi.' })
    setGroups(d.groups)
    setSaved(JSON.stringify(d.groups))
    setIsNew(new Set())
    setCourseGroupsCache(d.groups)
    setMsg({ ok: true, text: 'Saqlandi — bosh sahifa va o‘quvchi kabinetida 1 daqiqa ichida yangilanadi.' })
  }

  const input = 'w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-green'

  return (
    <div className="max-w-[860px]">
      <p className="mb-4 text-[12.5px] leading-relaxed text-ink-soft">
        Har bir Telegram kurs guruhi uchun banner (kartochka). <b>«Bosh sahifada»</b> — saytga kirgandagi «Telegram kurslari» bo‘limida
        ko‘rinadi; <b>«Kabinetda»</b> — o‘quvchilarning «Mening kurslarim» sahifasida hammaga ko‘rinadi (guruh a’zolari o‘z guruhini baribir
        ko‘radi). Tugagan guruhni <b>Arxiv</b> qiling — u hamma joydan yo‘qoladi, lekin eski vazifalar va a’zolar saqlanib qoladi.
      </p>

      <div className="flex flex-col gap-2.5">
        {groups.map((g) => {
          const open = openSlug === g.slug
          return (
            <div key={g.slug} className={`rounded-xl border bg-white ${g.archived ? 'border-dashed border-line opacity-70' : 'border-line'}`}>
              <div className="flex flex-wrap items-center gap-2 px-3.5 py-3">
                <span className={`size-3 shrink-0 rounded-full ${g.theme === 'nov' ? 'bg-orange-500' : 'bg-blue-600'}`} />
                <button type="button" onClick={() => setOpenSlug(open ? null : g.slug)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                  <b className="truncate text-[14px] text-ink">{g.title}</b>
                  <span className="font-mono text-[11px] text-ink-faint">({g.slug})</span>
                  {g.archived && <span className="rounded-full bg-bg-deep px-2 py-px text-[10px] font-extrabold text-ink-faint">ARXIV</span>}
                  <ChevronDown size={14} className={`text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {!g.archived && (
                  <>
                    <Toggle on={!!g.landing} onClick={() => patch(g.slug, { landing: !g.landing })} label="Bosh sahifada" />
                    <Toggle on={!!g.dashboard} onClick={() => patch(g.slug, { dashboard: !g.dashboard })} label="Kabinetda" />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => patch(g.slug, g.archived ? { archived: false } : { archived: true, landing: false, dashboard: false })}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11.5px] font-bold text-ink-soft hover:border-ink-faint"
                  title={g.archived ? 'Arxivdan qaytarish' : 'Guruh tugadi — arxivlash'}
                >
                  {g.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />} {g.archived ? 'Qaytarish' : 'Arxiv'}
                </button>
                {isNew.has(g.slug) && (
                  <button
                    type="button"
                    onClick={() => setGroups(groups.filter((x) => x.slug !== g.slug))}
                    className="text-ink-faint hover:text-red-600"
                    title="Hali saqlanmagan guruhni olib tashlash"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              {open && (
                <div className="grid gap-2.5 border-t border-line px-3.5 py-3 sm:grid-cols-2">
                  <label className="text-[11.5px] font-bold text-ink-soft">
                    Guruh nomi (sarlavha)
                    <input
                      className={input}
                      value={g.title}
                      onChange={(e) => {
                        const title = e.target.value
                        const p: Partial<CourseGroup> = { title }
                        // A brand-new group follows its title; a saved slug never changes (data points at it).
                        if (isNew.has(g.slug)) {
                          const slug = slugify(title) || g.slug
                          if (!groups.some((x) => x.slug === slug && x !== g)) {
                            p.slug = slug
                            setIsNew((s) => {
                              const n = new Set(s)
                              n.delete(g.slug)
                              n.add(slug)
                              return n
                            })
                            setOpenSlug(slug)
                          }
                        }
                        patch(g.slug, p)
                      }}
                    />
                  </label>
                  <label className="text-[11.5px] font-bold text-ink-soft">
                    Qisqa nom (admin tugmalarida)
                    <input className={input} value={g.short} onChange={(e) => patch(g.slug, { short: e.target.value })} />
                  </label>
                  <label className="text-[11.5px] font-bold text-ink-soft">
                    Yorliq (masalan «🔥 Qabul ochiq»)
                    <input className={input} value={g.tag ?? ''} onChange={(e) => patch(g.slug, { tag: e.target.value })} />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11.5px] font-bold text-ink-soft">
                      Rang
                      <select className={input} value={g.theme ?? 'dec'} onChange={(e) => patch(g.slug, { theme: e.target.value as 'nov' | 'dec' })}>
                        <option value="nov">To‘q sariq</option>
                        <option value="dec">Ko‘k</option>
                      </select>
                    </label>
                    <label className="text-[11.5px] font-bold text-ink-soft">
                      Kalendardagi oy
                      <select className={input} value={g.month ?? ''} onChange={(e) => patch(g.slug, { month: e.target.value })}>
                        <option value="">—</option>
                        {MONTHS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="text-[11.5px] font-bold text-ink-soft sm:col-span-2">
                    Tavsif (bir gap)
                    <input className={input} value={g.desc ?? ''} onChange={(e) => patch(g.slug, { desc: e.target.value })} />
                  </label>
                  <label className="text-[11.5px] font-bold text-ink-soft sm:col-span-2">
                    Afzalliklar (har biri yangi qatorda)
                    <textarea
                      className={input}
                      rows={4}
                      value={(g.bullets ?? []).join('\n')}
                      onChange={(e) => patch(g.slug, { bullets: e.target.value.split('\n') })}
                    />
                  </label>
                  <label className="text-[11.5px] font-bold text-ink-soft sm:col-span-2">
                    «Batafsil ko‘rish» havolasi
                    <input className={input} value={g.link ?? ''} onChange={(e) => patch(g.slug, { link: e.target.value })} placeholder="https://t.me/..." />
                  </label>
                  <p className="text-[11px] text-ink-faint sm:col-span-2">
                    Slug: <b className="font-mono">{g.slug}</b> — botda guruhni bog‘lash uchun: <span className="font-mono">/kurs {g.slug}</span>
                    {isNew.has(g.slug) ? ' (saqlangandan keyin o‘zgarmaydi)' : ''}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] font-bold text-ink hover:border-green">
          <Plus size={14} /> Yangi guruh banneri
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green px-3.5 py-2 text-[12.5px] font-extrabold text-white hover:brightness-110 disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Saqlash
        </button>
        {dirty && !busy && <span className="text-[12px] font-semibold text-amber-700">Saqlanmagan o‘zgarishlar bor</span>}
      </div>
      {msg && (
        <p className={`mt-2 flex items-start gap-1.5 text-[12.5px] font-semibold ${msg.ok ? 'text-green-deep' : 'text-red-600'}`}>
          {!msg.ok && <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
          {msg.text}
        </p>
      )}
    </div>
  )
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11.5px] font-bold transition ${
        on ? 'border-green bg-green-mist text-green-deep' : 'border-line text-ink-faint hover:border-ink-faint'
      }`}
      title={on ? `${label}: ko‘rinadi — bosib yashiring` : `${label}: yashirin — bosib ko‘rsating`}
    >
      {on ? <Eye size={13} /> : <EyeOff size={13} />} {label}
    </button>
  )
}
