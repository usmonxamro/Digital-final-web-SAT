'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Math as Tex, MixedText } from '@/components/math'
import type { DarajaQuestion, Lang, Prep } from '@/lib/daraja/types'

type Result = { correct: number; total: number; scaled: number; band: string; relaxed: boolean; detail: Record<string, boolean>; domains: Record<string, { c: number; t: number }> }

const S = {
  uz: {
    title: 'Matematik darajangizni aniqlang', sub: 'Ingliz tilini bilmasangiz ham — savollar to‘liq o‘zbek tilida. 2 qism, 22 tadan 44 ta savol.',
    pickLang: 'Test tilini tanlang', uz: 'O‘zbekcha', en: 'English', prepQ: 'SAT savollariga qanchalik tayyorlangansiz?',
    prep: { none: ['Umuman tayyorlanmaganman', 'SAT savollarini hali yechmaganman'], little: ['Ozgina tayyorlanganman', 'Bir necha savol yechganman'], mid: ['O‘rtacha', 'Muntazam mashq qilaman'], good: ['Yaxshi tayyorman', 'Mock testlarni yechib kelaman'] },
    prepNote: 'Bu javob natijani adolatli baholash uchun kerak.', name: 'Ismingiz (ixtiyoriy)', contact: 'Telefon yoki Telegram (ixtiyoriy)',
    start: 'Testni boshlash', module: 'qism', q: 'Savol', answer: 'Javobingiz', prev: 'Oldingi', next: 'Keyingi', finish: 'Yakunlash', answered: 'javob berildi',
    next2: '2-qismga o‘tish', confirm: 'Javob bermagan savollar bor. Baribir yakunlaysizmi?', loading: 'Yuklanmoqda…', err: 'Xatolik yuz berdi. Qayta urinib ko‘ring.',
    result: 'Natijangiz', score: 'Taxminiy SAT Math bali', correct: 'to‘g‘ri javob', domains: 'Mavzular bo‘yicha', relaxed: 'Siz SAT formatiga tayyorlanmaganingiz uchun, maktab dasturida bo‘lmagan format savollaridagi xatolar bahoga ta’sir qilmadi.',
    bands: { start: 'Poydevor bor — endi SAT formatini o‘rganish kerak. Bu daraja ko‘pchilik tayyorlanmagan o‘quvchilarda uchraydi va tez o‘sadi.', base: 'Yaxshi asos. Tizimli tayyorgarlik bilan 650+ ga chiqish real.', mid: 'Kuchli daraja. Murakkab savollar ustida ishlasangiz, 720+ ga chiqasiz.', high: 'Juda yuqori daraja. Mukammallik uchun xatolar tahlili qoldi.', top: 'Mukammal natija!' },
    cta: 'Kursga yozilish', retry: 'Qayta topshirish', home: 'Bosh sahifa', domainNames: { 'Algebra': 'Algebra', 'Advanced Math': 'Ilg‘or matematika', 'Problem-Solving and Data Analysis': 'Masalalar va ma’lumotlar tahlili', 'Geometry and Trigonometry': 'Geometriya va trigonometriya' } as Record<string, string>,
  },
  en: {
    title: 'Find out your math level', sub: 'Two modules, 22 questions each — 44 questions in total.',
    pickLang: 'Choose the test language', uz: 'O‘zbekcha', en: 'English', prepQ: 'How prepared are you for SAT questions?',
    prep: { none: ['Not prepared at all', 'I have never solved SAT questions'], little: ['A little', 'I have tried a few questions'], mid: ['Moderately', 'I practice regularly'], good: ['Well prepared', 'I take full mock tests'] },
    prepNote: 'This answer lets us score you fairly.', name: 'Your name (optional)', contact: 'Phone or Telegram (optional)',
    start: 'Start the test', module: 'Module', q: 'Question', answer: 'Your answer', prev: 'Previous', next: 'Next', finish: 'Finish', answered: 'answered',
    next2: 'Go to Module 2', confirm: 'Some questions are unanswered. Finish anyway?', loading: 'Loading…', err: 'Something went wrong. Please try again.',
    result: 'Your result', score: 'Estimated SAT Math score', correct: 'correct', domains: 'By domain', relaxed: 'Because you are new to the SAT, mistakes on SAT-format-only questions were not counted against you.',
    bands: { start: 'You have a base — next, learn the SAT format. This level is common for unprepared students and grows fast.', base: 'A solid base. With structured prep, 650+ is realistic.', mid: 'Strong level. Work on the hardest questions to reach 720+.', high: 'Very high level. Only error analysis is left.', top: 'Perfect score!' },
    cta: 'Join the course', retry: 'Retake', home: 'Home', domainNames: {} as Record<string, string>,
  },
}

function Prompt({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  for (let i = 0; i < lines.length; ) {
    if (lines[i].includes(' | ')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes(' | ')) rows.push(lines[i++].split(' | '))
      out.push(
        <table key={i} className="dj-table"><tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}><MixedText text={c} /></td>)}</tr>)}</tbody></table>,
      )
    } else out.push(<p key={i}><MixedText text={lines[i++]} /></p>)
  }
  return <>{out}</>
}

export function DarajaTest() {
  const [lang, setLang] = useState<Lang>('uz')
  const [prep, setPrep] = useState<Prep | null>(null)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [qs, setQs] = useState<DarajaQuestion[] | null>(null)
  const [started, setStarted] = useState(false)
  const [mod, setMod] = useState<1 | 2>(1)
  const [idx, setIdx] = useState(0)
  const [ans, setAns] = useState<Record<string, string>>({})
  const [res, setRes] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const t = S[lang]

  useEffect(() => {
    let live = true
    setQs(null)
    fetch(`/api/daraja/test?lang=${lang}`).then((r) => r.json()).then((d) => live && setQs(d.questions)).catch(() => live && setError(true))
    return () => { live = false }
  }, [lang])

  const list = useMemo(() => (qs ?? []).filter((q) => q.module === mod), [qs, mod])
  const q = list[idx]
  const key = q ? `${q.module}-${q.n}` : ''
  const answeredCount = list.filter((x) => ans[`${x.module}-${x.n}`]).length

  async function finish() {
    const missing = (qs ?? []).filter((x) => !ans[`${x.module}-${x.n}`]).length
    if (missing && !window.confirm(t.confirm)) return
    setBusy(true); setError(false)
    try {
      const r = await fetch('/api/daraja/grade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, prep, name, contact, answers: ans }) })
      if (!r.ok) throw new Error()
      setRes(await r.json())
      window.scrollTo({ top: 0 })
    } catch { setError(true) } finally { setBusy(false) }
  }

  const wrap = 'dj-wrap'
  if (res) {
    return (
      <main className={wrap}><style>{CSS}</style>
        <div className="dj-card dj-center">
          <h1>{t.result}</h1>
          <p className="dj-muted">{t.score}</p>
          <div className="dj-score">{res.scaled}<small>/800</small></div>
          <p className="dj-muted">{res.correct}/{res.total} {t.correct}</p>
          <p className="dj-band">{t.bands[res.band as keyof typeof t.bands]}</p>
          {res.relaxed && <p className="dj-note">{t.relaxed}</p>}
          <h3>{t.domains}</h3>
          <div className="dj-doms">
            {Object.entries(res.domains).map(([d, v]) => (
              <div key={d}><span>{t.domainNames[d] ?? d}</span><div className="dj-bar"><i style={{ width: `${(100 * v.c) / v.t}%` }} /></div><b>{v.c}/{v.t}</b></div>
            ))}
          </div>
          <div className="dj-actions">
            <a className="dj-btn" href="https://t.me/satbyusmon" target="_blank" rel="noopener noreferrer">{t.cta}</a>
            <button className="dj-btn dj-ghost" onClick={() => { setRes(null); setStarted(false); setAns({}); setMod(1); setIdx(0) }}>{t.retry}</button>
            <Link className="dj-btn dj-ghost" href="/">{t.home}</Link>
          </div>
        </div>
      </main>
    )
  }

  if (!started) {
    return (
      <main className={wrap}><style>{CSS}</style>
        <div className="dj-card">
          <h1>{t.title}</h1><p className="dj-muted">{t.sub}</p>
          <h3>{t.pickLang}</h3>
          <div className="dj-row">{(['uz', 'en'] as Lang[]).map((l) => <button key={l} className={`dj-opt ${lang === l ? 'on' : ''}`} onClick={() => setLang(l)}>{l === 'uz' ? '🇺🇿 O‘zbekcha' : '🇬🇧 English'}</button>)}</div>
          <h3>{t.prepQ}</h3>
          <div className="dj-grid">{(Object.keys(t.prep) as Prep[]).map((p) => <button key={p} className={`dj-opt ${prep === p ? 'on' : ''}`} onClick={() => setPrep(p)}><b>{t.prep[p][0]}</b><span>{t.prep[p][1]}</span></button>)}</div>
          <p className="dj-muted dj-small">{t.prepNote}</p>
          <div className="dj-row"><input className="dj-in" placeholder={t.name} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /><input className="dj-in" placeholder={t.contact} value={contact} maxLength={80} onChange={(e) => setContact(e.target.value)} /></div>
          {error && <p className="dj-err">{t.err}</p>}
          <button className="dj-btn" disabled={!prep || !qs} onClick={() => setStarted(true)}>{qs ? t.start : t.loading}</button>
        </div>
      </main>
    )
  }

  if (!q) return <main className={wrap}><style>{CSS}</style><p>{t.loading}</p></main>
  const last = idx === list.length - 1
  return (
    <main className={wrap}><style>{CSS}</style>
      <div className="dj-top"><b>{t.module} {mod}/2</b><span>{answeredCount}/{list.length} {t.answered}</span></div>
      <div className="dj-pal">{list.map((x, i) => <button key={x.n} className={`${i === idx ? 'cur' : ''} ${ans[`${x.module}-${x.n}`] ? 'done' : ''}`} onClick={() => setIdx(i)}>{i + 1}</button>)}</div>
      <div className="dj-card">
        <div className="dj-qh">{t.q} {idx + 1}</div>
        <div className="dj-prompt"><Prompt text={q.prompt} /></div>
        {q.equations?.map((e, i) => <div key={i} className="dj-eq"><Tex tex={e} display /></div>)}
        {q.image && <img className="dj-img" src={q.image} alt="" />}
        {q.type === 'mcq' ? (
          <div className="dj-choices">{q.choices!.map((c) => (
            <button key={c.id} className={`dj-ch ${ans[key] === c.id ? 'on' : ''}`} onClick={() => setAns({ ...ans, [key]: c.id })}>
              <i>{c.id}</i><span>{c.tex !== undefined ? <Tex tex={c.tex} /> : <MixedText text={c.text ?? ''} />}</span>
            </button>))}
          </div>
        ) : <input className="dj-in dj-grid-in" inputMode="decimal" placeholder={t.answer} maxLength={10} value={ans[key] ?? ''} onChange={(e) => setAns({ ...ans, [key]: e.target.value })} />}
        <div className="dj-actions">
          <button className="dj-btn dj-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>{t.prev}</button>
          {!last ? <button className="dj-btn" onClick={() => setIdx(idx + 1)}>{t.next}</button>
            : mod === 1 ? <button className="dj-btn" onClick={() => { setMod(2); setIdx(0); window.scrollTo({ top: 0 }) }}>{t.next2}</button>
            : <button className="dj-btn" disabled={busy} onClick={finish}>{busy ? t.loading : t.finish}</button>}
        </div>
        {error && <p className="dj-err">{t.err}</p>}
      </div>
    </main>
  )
}

const CSS = `
.dj-wrap{max-width:760px;margin:0 auto;padding:24px 16px 60px;font-family:system-ui,sans-serif;color:#0f172a}
.dj-card{background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:26px;box-shadow:0 8px 30px rgba(15,23,42,.06)}
.dj-center{text-align:center}.dj-card h1{font-size:28px;font-weight:800;margin:0 0 8px}.dj-card h3{margin:22px 0 10px;font-size:16px}
.dj-muted{color:#64748b}.dj-small{font-size:13px}.dj-row{display:flex;gap:10px;flex-wrap:wrap}.dj-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dj-opt{flex:1;text-align:left;border:2px solid #e2e8f0;background:#fff;border-radius:14px;padding:12px 14px;cursor:pointer;display:flex;flex-direction:column;gap:2px;font-size:15px}
.dj-opt span{font-size:13px;color:#64748b}.dj-opt.on{border-color:#f97316;background:#fff7ed}
.dj-in{flex:1;min-width:180px;border:2px solid #e2e8f0;border-radius:12px;padding:12px;font-size:15px;margin:10px 0}.dj-grid-in{width:100%;font-size:20px}
.dj-btn{display:inline-block;background:#f97316;color:#fff;border:0;border-radius:12px;padding:13px 22px;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none;margin-top:14px}
.dj-btn:disabled{opacity:.5;cursor:not-allowed}.dj-ghost{background:#f1f5f9;color:#0f172a}
.dj-actions{display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap}.dj-center .dj-actions{justify-content:center}
.dj-top{display:flex;justify-content:space-between;margin-bottom:10px}.dj-pal{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.dj-pal button{width:34px;height:34px;border-radius:9px;border:1px solid #cbd5e1;background:#fff;cursor:pointer}.dj-pal .done{background:#dcfce7}.dj-pal .cur{border:2px solid #f97316;font-weight:800}
.dj-qh{font-weight:800;color:#f97316;margin-bottom:10px}.dj-prompt p{margin:0 0 10px;font-size:18px;line-height:1.55}.dj-eq{margin:8px 0;overflow-x:auto}
.dj-table{border-collapse:collapse;margin:8px 0 14px}.dj-table td{border:1px solid #94a3b8;padding:6px 16px;text-align:center}
.dj-img{display:block;width:100%;max-width:640px;margin:12px auto}
.dj-choices{display:grid;gap:10px;margin:16px 0}.dj-ch{display:flex;gap:12px;align-items:center;text-align:left;border:2px solid #e2e8f0;background:#fff;border-radius:14px;padding:12px 14px;cursor:pointer;font-size:17px}
.dj-ch i{font-style:normal;font-weight:800;width:30px;height:30px;border-radius:50%;border:2px solid #94a3b8;display:grid;place-items:center;flex:none}.dj-ch.on{border-color:#f97316;background:#fff7ed}.dj-ch.on i{background:#f97316;color:#fff;border-color:#f97316}
.dj-score{font-size:72px;font-weight:900;color:#f97316}.dj-score small{font-size:24px;color:#64748b}.dj-band{font-size:18px;line-height:1.5}
.dj-note{background:#eff6ff;border-radius:12px;padding:12px;font-size:14px;color:#1e40af}.dj-err{color:#dc2626}
.dj-doms{display:grid;gap:10px;text-align:left}.dj-doms>div{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:center;font-size:14px}.dj-bar{background:#e2e8f0;border-radius:99px;height:10px}.dj-bar i{display:block;height:100%;background:#f97316;border-radius:99px}
@media(max-width:560px){.dj-grid{grid-template-columns:1fr}.dj-doms>div{grid-template-columns:1fr auto}.dj-bar{grid-column:1/3}}
`
