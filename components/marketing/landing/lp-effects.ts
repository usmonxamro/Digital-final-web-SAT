import type { Lang } from '@/lib/i18n'
import { lpT } from '@/components/marketing/landing/lp-i18n'

/**
 * Behaviour of the static landing markup (LP_BODY): FAQ accordion, scroll-reveal,
 * stat count-up and the looping "Desmos at work" hero demo.
 * Returns a cleanup that stops everything (used when the language changes or the page unmounts).
 */
export function startLpEffects(root: HTMLElement, lang: Lang): () => void {
  let stopped = false
  const cleanups: Array<() => void> = []
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ---------------- FAQ accordion ---------------- */
  const onClick = (e: Event) => {
    const b = (e.target as Element).closest('.q button')
    if (b && b.parentElement) b.parentElement.classList.toggle('open')
  }
  root.addEventListener('click', onClick)
  cleanups.push(() => root.removeEventListener('click', onClick))

  /* ---------------- book preview lightbox ---------------- */
  cleanups.push(startBookPreview(root))

  /* ---------------- video lessons: rotating thumbnails + in-site player ---------------- */
  cleanups.push(startVideoLessons(root, lang, reduce))

  /* ---------------- scroll reveal + count-up ---------------- */
  if ('IntersectionObserver' in window && !reduce) {
    const sel = '.f-card,.c-card,.p-card,.r-card,.exam,.dm,.stats,.cta,.q,.sec-head,.hero-checks,.avatars,.bk-main,.bk-soon,.bk-peek'
    const countUp = (el: Element) => {
      el.querySelectorAll('.stat b').forEach((b) => {
        const m = (b.textContent ?? '').trim().match(/^([\d,]+)\+$/)
        if (!m) return
        const target = parseInt(m[1].replace(/,/g, ''), 10)
        const comma = m[1].indexOf(',') > -1
        let t0: number | null = null
        const step = (ts: number) => {
          if (stopped) return
          if (t0 === null) t0 = ts
          const p = Math.min((ts - t0) / 1400, 1)
          const v = Math.round(target * (1 - Math.pow(1 - p, 3)))
          b.textContent = (comma ? v.toLocaleString('en-US') : String(v)) + '+'
          if (p < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      })
    }
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
            if (e.target.classList.contains('stats')) countUp(e.target)
          }
        })
      },
      { threshold: 0.1 },
    )
    root.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
      el.classList.add('reveal')
      el.style.animationDelay = (i % 4) * 90 + 'ms'
      io.observe(el)
    })
    cleanups.push(() => io.disconnect())
  }

  /* ---------------- hero demo ---------------- */
  const stopDemo = startDemo(root, lang, () => stopped, reduce)
  cleanups.push(stopDemo)

  return () => {
    stopped = true
    cleanups.forEach((fn) => fn())
  }
}

type Pt = { x: number; y: number }

function startDemo(root: HTMLElement, lang: Lang, isStopped: () => boolean, reduce: boolean): () => void {
  const wrap = root.querySelector<HTMLElement>('#dm')
  const stage = root.querySelector<HTMLElement>('#dmStage')
  if (!wrap || !stage) return () => {}
  const $ = (id: string) => root.querySelector<HTMLElement>('#' + id) as HTMLElement
  const T = (s: string) => lpT(s, lang)
  const W = 820
  let S = 1
  const fit = () => {
    S = wrap.clientWidth / W || 1
    stage.style.transform = 'scale(' + S + ')'
  }
  fit()
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
  ro?.observe(wrap)
  if (!ro) window.addEventListener('resize', fit)

  /* ---- Desmos graph (SVG) ---- */
  {
    const g = $('gsvg')
    const Wd = 170, H = 400, x0 = 42.5, ux = 10.625, y0 = 210, uy = 5
    const X = (v: number) => x0 + ux * v
    const Y = (v: number) => y0 - uy * v
    let s = ''
    for (let i = -4; i <= 12; i += 2) s += `<line x1="${X(i)}" y1="0" x2="${X(i)}" y2="${H}" stroke="${i % 10 === 0 ? '#c9c9c9' : '#ebebeb'}" stroke-width="1"/>`
    for (let i = -35; i <= 40; i += 5) s += `<line x1="0" y1="${Y(i)}" x2="${Wd}" y2="${Y(i)}" stroke="${i % 10 === 0 ? '#c9c9c9' : '#ebebeb'}" stroke-width="1"/>`
    s += `<line x1="0" y1="${Y(0)}" x2="${Wd}" y2="${Y(0)}" stroke="#333" stroke-width="1.3"/>`
    s += `<line x1="${X(0)}" y1="0" x2="${X(0)}" y2="${H}" stroke="#333" stroke-width="1.3"/>`
    for (const v of [30, 20, 10, -10, -20, -30])
      s += `<text x="${X(0) - 4}" y="${Y(v) + 3}" text-anchor="end" font-size="8.5" fill="#444" font-family="Inter,sans-serif">${v < 0 ? '−' + -v : v}</text>`
    s += `<text x="${X(10)}" y="${Y(0) + 12}" text-anchor="middle" font-size="8.5" fill="#444" font-family="Inter,sans-serif">10</text>`
    s += `<text x="${X(0) + 4}" y="${Y(0) + 12}" font-size="8.5" fill="#444" font-family="Inter,sans-serif">0</text>`
    let d = ''
    let first = true
    for (let x = -4; x <= 12.0001; x += 0.1) {
      const y = 2 * x * x - 14 * x - 36
      d += (first ? 'M' : 'L') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1) + ' '
      first = false
    }
    s += `<path id="curve" pathLength="1" d="${d}" fill="none" stroke="#2d8a3e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
    s += `<circle id="p1" class="pt" cx="${X(9)}" cy="${Y(0)}" r="3.8" fill="#c94040" stroke="#7d2020" stroke-width="1"/>`
    s += `<circle id="p2" class="pt" cx="${X(-2)}" cy="${Y(0)}" r="3.8" fill="#c94040" stroke="#7d2020" stroke-width="1"/>`
    g.innerHTML = s
  }

  /* ---- elements ---- */
  const cur = $('cur'), calcBtn = $('calcBtn'), dw = $('dw'), plus = $('plus'), menu = $('menu'), mTable = $('mTable')
  const r0 = $('r0'), r1 = $('r1'), r2 = $('r2'), r3 = $('r3'), m0 = $('m0'), m2 = $('m2'), m3 = $('m3')
  const reg = $('reg'), res = $('res'), val = $('val'), q1 = $('q1'), q2 = $('q2'), qwrap = $('qwrap')
  const optD = $('optD'), optC2 = $('optC2'), nxt = $('nxt'), toast = $('toast'), qNum = $('qNum')
  const curve = $('curve'), p1 = $('p1'), p2 = $('p2'), capT = $('capT'), capS = $('capS'), chip2 = $('chip2')
  const cells = [].slice.call(r1.querySelectorAll('td.c')) as HTMLElement[]

  const REG = ['<i>y</i>', '<sub>1</sub>', ' ~ ', '<i>a</i>', '<i>x</i>', '<span class="ss"><i>2</i><i>1</i></span>', ' + ', '<i>b</i>', '<i>x</i>', '<sub>1</sub>', ' + ', '<i>c</i>', '&nbsp;{', '<i>a</i>', ' &gt; ', '1', '}']
  const AB = ['<i>a</i>', ' + ', '<i>b</i>']

  /* ---- pause when off-screen ---- */
  let visible = true
  let waiting: Array<() => void> = []
  let io: IntersectionObserver | null = null
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(
      (es) => {
        visible = es[0].isIntersecting
        if (visible) {
          const f = waiting
          waiting = []
          f.forEach((fn) => fn())
        }
      },
      { threshold: 0.05 },
    )
    io.observe(wrap)
  }
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(() => {
        if (isStopped()) return // never resolves → the loop ends quietly
        if (visible) resolve()
        else waiting.push(resolve)
      }, ms)
    })

  /* ---- helpers ---- */
  const pos = (el: HTMLElement, ox?: number, oy?: number): Pt => {
    const r = el.getBoundingClientRect()
    const sr = stage.getBoundingClientRect()
    return { x: (r.left - sr.left + r.width * (ox == null ? 0.5 : ox)) / S, y: (r.top - sr.top + r.height * (oy == null ? 0.5 : oy)) / S }
  }
  let cx = 0, cy = 0
  let hovEl: HTMLElement | null = null
  let actEl: HTMLElement | null = null
  const place = (x: number, y: number) => {
    cur.style.transition = 'opacity .3s ease'
    cur.style.transform = `translate(${x}px,${y}px)`
    cx = x
    cy = y
    void cur.offsetWidth
  }
  const moveTo = async (p: Pt) => {
    const dist = Math.hypot(p.x - cx, p.y - cy)
    const t = Math.min(1100, 340 + dist * 1.25)
    cur.style.transition = `transform ${t}ms cubic-bezier(.45,.05,.25,1), opacity .3s ease`
    cur.style.transform = `translate(${p.x}px,${p.y}px)`
    cx = p.x
    cy = p.y
    await sleep(t + 50)
  }
  const hover = (el: HTMLElement | null) => {
    if (hovEl) hovEl.classList.remove('hov')
    hovEl = el
    if (el) el.classList.add('hov')
  }
  const go = async (el: HTMLElement, ox?: number, oy?: number) => {
    hover(null)
    await moveTo(pos(el, ox, oy))
    hover(el)
  }
  const act = (el: HTMLElement | null) => {
    if (actEl) actEl.classList.remove('act')
    actEl = el
    if (el) el.classList.add('act')
  }
  const ripple = (x: number, y: number) => {
    const d = document.createElement('div')
    d.className = 'dm-rip'
    d.style.left = x + 'px'
    d.style.top = y + 'px'
    stage.appendChild(d)
    setTimeout(() => d.parentNode?.removeChild(d), 650)
  }
  const click = async () => {
    cur.classList.add('down')
    ripple(cx, cy)
    await sleep(140)
    cur.classList.remove('down')
    await sleep(130)
  }
  const typeIn = async (el: HTMLElement, toks: string[], ms: number) => {
    for (let i = 0; i < toks.length; i++) {
      el.insertAdjacentHTML('beforeend', toks[i])
      await sleep(ms + Math.random() * ms * 0.35)
    }
  }
  const cap = (t: string, s: string) => {
    chip2.classList.add('sw')
    setTimeout(() => {
      if (isStopped()) return
      capT.innerHTML = T(t)
      capS.innerHTML = T(s)
      chip2.classList.remove('sw')
    }, 170)
  }

  const reset = () => {
    hover(null)
    act(null)
    calcBtn.classList.remove('on', 'hov')
    dw.classList.remove('open')
    qwrap.classList.remove('dim')
    menu.classList.remove('show')
    plus.classList.remove('on', 'hov')
    ;[r1, r2, r3].forEach((r) => r.classList.remove('show'))
    r0.classList.add('show')
    m0.classList.add('act')
    cells.forEach((c) => {
      c.innerHTML = ''
      c.classList.remove('act')
    })
    m2.innerHTML = ''
    m3.innerHTML = ''
    m2.classList.remove('act')
    m3.classList.remove('act')
    reg.classList.remove('show')
    res.classList.remove('show')
    val.classList.remove('hl')
    curve.classList.remove('draw')
    p1.classList.remove('show')
    p2.classList.remove('show')
    q1.classList.remove('out')
    q2.classList.remove('in')
    wrap.querySelectorAll('.opt').forEach((o) => o.classList.remove('sel', 'hov'))
    toast.classList.remove('show')
    qNum.textContent = 'Question 31 of 54'
    capT.innerHTML = T('Desmos kalkulyatori')
    capS.innerHTML = T('bilan ishlash')
    cur.classList.remove('vis', 'down')
  }

  const finalStatic = () => {
    reset()
    r0.classList.remove('show')
    m0.classList.remove('act')
    ;[r1, r2, r3].forEach((r) => r.classList.add('show'))
    const v = ['9', '0', '−2', '0']
    cells.forEach((c, i) => (c.textContent = v[i]))
    REG.forEach((t) => m2.insertAdjacentHTML('beforeend', t))
    AB.forEach((t) => m3.insertAdjacentHTML('beforeend', t))
    reg.classList.add('show')
    res.classList.add('show')
    val.classList.add('hl')
    curve.classList.add('draw')
    p1.classList.add('show')
    p2.classList.add('show')
    dw.classList.add('open')
    calcBtn.classList.add('on')
    qwrap.classList.add('dim')
    capT.innerHTML = T('Natija topildi')
    capS.innerHTML = 'a + b = −12'
  }

  /* ---- main scenario ---- */
  const play = async () => {
    await sleep(850)
    place(560, 400)
    cur.classList.add('vis')
    await sleep(350)

    await moveTo(pos(q1, 0.62, 0.3))
    await sleep(500)

    // 1) opens Desmos
    await go(calcBtn)
    await sleep(280)
    await click()
    calcBtn.classList.add('on')
    dw.classList.add('open')
    qwrap.classList.add('dim')
    cap('Desmos ochilmoqda', 'Calculator tugmasi bosildi')
    await sleep(900)

    // 2) "+" → table
    await go(plus)
    await sleep(250)
    await click()
    plus.classList.add('on')
    menu.classList.add('show')
    await sleep(500)
    await go(mTable, 0.3, 0.5)
    await sleep(380)
    await click()
    hover(null)
    menu.classList.remove('show')
    plus.classList.remove('on')
    m0.classList.remove('act')
    r0.classList.remove('show')
    r1.classList.add('show')
    cap('Table qo‘shildi', 'nuqtalar kiritilmoqda')
    await sleep(750)

    // 3) two points
    await go(cells[0])
    await sleep(150)
    await click()
    hover(null)
    act(cells[0])
    await sleep(260)
    await typeIn(cells[0], ['9'], 130)
    await sleep(380)
    act(cells[1])
    await sleep(220)
    await typeIn(cells[1], ['0'], 130)
    p1.classList.add('show')
    await sleep(480)
    act(cells[2])
    await sleep(220)
    await typeIn(cells[2], ['−', '2'], 140)
    await sleep(380)
    act(cells[3])
    await sleep(220)
    await typeIn(cells[3], ['0'], 130)
    p2.classList.add('show')
    await sleep(420)
    act(null)
    cap('Nuqtalar kiritildi', '(9, 0) va (−2, 0)')
    await sleep(350)

    // 4) regression
    r2.classList.add('show')
    await sleep(700)
    await go(m2, 0.25, 0.5)
    await sleep(150)
    await click()
    hover(null)
    m2.classList.add('act')
    await sleep(220)
    await typeIn(m2, REG, 52)
    m2.classList.remove('act')
    await sleep(320)
    reg.classList.add('show')
    curve.classList.add('draw')
    cap('Regressiya hisoblandi', 'a = 2,  b = −14,  c = −36')
    await sleep(1250)

    // 5) a + b
    r3.classList.add('show')
    await sleep(700)
    await go(m3, 0.25, 0.5)
    await sleep(150)
    await click()
    hover(null)
    m3.classList.add('act')
    await sleep(220)
    await typeIn(m3, AB, 130)
    m3.classList.remove('act')
    await sleep(380)
    res.classList.add('show')
    await sleep(550)
    val.classList.add('hl')
    cap('Natija topildi', 'a + b = −12')
    await sleep(1700)

    // 6) closes Desmos
    await go(calcBtn)
    await sleep(260)
    await click()
    calcBtn.classList.remove('on')
    dw.classList.remove('open')
    qwrap.classList.remove('dim')
    hover(null)
    await sleep(950)

    // 7) picks the answer
    await go(optD, 0.5, 0.5)
    await sleep(800)
    await click()
    hover(null)
    optD.classList.add('sel')
    toast.innerHTML = '<b>✓</b> ' + T('Javob belgilandi: D')
    toast.classList.add('show')
    cap('To‘g‘ri javob', 'D) −12 belgilandi ✓')
    await sleep(1200)

    // 8) next question
    await go(nxt)
    await sleep(380)
    await click()
    hover(null)
    q1.classList.add('out')
    q2.classList.add('in')
    qNum.textContent = 'Question 32 of 54'
    toast.classList.remove('show')
    cap('Keyingi savol', '32 / 54')
    await sleep(900)
    await go(optC2, 0.5, 0.5)
    await sleep(1500)

    // loop reset
    cur.classList.remove('vis')
    qwrap.classList.add('rst')
    await sleep(600)
    qwrap.classList.add('notr')
    reset()
    void qwrap.offsetWidth
    qwrap.classList.remove('notr')
    qwrap.classList.remove('rst')
  }

  const main = async () => {
    reset()
    if (reduce) {
      finalStatic()
      return
    }
    // eslint-disable-next-line no-constant-condition
    while (true) await play()
  }
  void main()

  return () => {
    ro?.disconnect()
    io?.disconnect()
    window.removeEventListener('resize', fit)
  }
}


/** Landing's book section: opens the first pages of the book in a full-screen viewer (buttons, arrows, swipe, Esc). */
function startBookPreview(root: HTMLElement): () => void {
  const lb = root.querySelector<HTMLElement>('.bk-lb')
  if (!lb) return () => {}
  let pages: string[] = []
  try {
    pages = JSON.parse(lb.getAttribute('data-pages') || '[]')
  } catch {
    pages = []
  }
  if (!pages.length) return () => {}

  const img = lb.querySelector<HTMLImageElement>('.bk-lb-img')!
  const count = lb.querySelector<HTMLElement>('.bk-lb-count')!
  const prev = lb.querySelector<HTMLButtonElement>('[data-bk-step="-1"]')!
  const next = lb.querySelector<HTMLButtonElement>('[data-bk-step="1"]')!
  let idx = 0
  let isOpen = false
  let startX = 0

  const show = (i: number) => {
    idx = Math.max(0, Math.min(pages.length - 1, i))
    img.src = pages[idx]
    count.textContent = idx + 1 + ' / ' + pages.length
    prev.disabled = idx === 0
    next.disabled = idx === pages.length - 1
    // Warm the neighbours so flipping pages feels instant.
    for (const j of [idx - 1, idx + 1]) if (pages[j]) new Image().src = pages[j]
  }
  const open = (i: number) => {
    show(i)
    isOpen = true
    lb.classList.add('open')
    lb.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
  }
  const close = () => {
    if (!isOpen) return
    isOpen = false
    lb.classList.remove('open')
    lb.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
  }

  const onClick = (e: Event) => {
    const t = e.target as Element
    const o = t.closest('[data-bk-open]')
    if (o) {
      open(Number(o.getAttribute('data-bk-open')) || 0)
      return
    }
    if (!isOpen) return
    const st = t.closest('[data-bk-step]')
    if (st) show(idx + Number(st.getAttribute('data-bk-step')))
    else if (t.closest('[data-bk-close]') || t === lb || t.classList.contains('bk-lb-stage')) close()
  }
  const onKey = (e: KeyboardEvent) => {
    if (!isOpen) return
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowRight') show(idx + 1)
    else if (e.key === 'ArrowLeft') show(idx - 1)
  }
  const onTouchStart = (e: TouchEvent) => {
    startX = e.touches[0].clientX
  }
  const onTouchEnd = (e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - startX
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1))
  }

  root.addEventListener('click', onClick)
  document.addEventListener('keydown', onKey)
  lb.addEventListener('touchstart', onTouchStart, { passive: true })
  lb.addEventListener('touchend', onTouchEnd, { passive: true })
  return () => {
    root.removeEventListener('click', onClick)
    document.removeEventListener('keydown', onKey)
    lb.removeEventListener('touchstart', onTouchStart)
    lb.removeEventListener('touchend', onTouchEnd)
    if (isOpen) document.body.style.overflow = ''
  }
}

/** The lesson videos shown on the landing (rotating thumbnails on the "Video Lessons" card). */
export const LP_VIDEOS = ['Uk7CSYP1Bc8', '43jMZd4mHRY', 'qtGuDP16NYg']

/**
 * "Video Lessons" card: the three thumbnails cross-fade every few seconds; a tap opens an in-site
 * YouTube player (phone and desktop alike) with the other lessons underneath to switch between.
 */
function startVideoLessons(root: HTMLElement, lang: Lang, reduce: boolean): () => void {
  const card = root.querySelector<HTMLElement>('.vid-rot')
  let timer: number | undefined
  let idx = 0
  const show = (n: number) => {
    if (!card) return
    idx = (n + LP_VIDEOS.length) % LP_VIDEOS.length
    card.querySelectorAll('.vr-imgs img').forEach((im, i) => im.classList.toggle('on', i === idx))
    card.querySelectorAll('.vr-dots i').forEach((d, i) => d.classList.toggle('on', i === idx))
    card.dataset.lpVideo = String(idx)
  }
  if (card && !reduce) timer = window.setInterval(() => show(idx + 1), 3200)

  let modal: HTMLElement | null = null
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close()
  }
  const close = () => {
    if (!modal) return
    modal.remove()
    modal = null
    document.documentElement.style.overflow = ''
    document.removeEventListener('keydown', onKey)
  }
  const play = (n: number) => {
    if (!modal) return
    const id = LP_VIDEOS[n]
    const frame = modal.querySelector<HTMLElement>('.vm-frame')!
    frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="${lpT('Video dars', lang)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`
    modal.querySelectorAll('.vm-list button').forEach((b, i) => b.classList.toggle('on', i === n))
  }
  const open = (n: number) => {
    close()
    modal = document.createElement('div')
    modal.className = 'vm'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.innerHTML = `<div class="vm-box">
      <div class="vm-head"><b>${lpT('Video darslar', lang)}</b><button type="button" class="vm-x" aria-label="${lpT('Videoni yopish', lang)}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="vm-frame"></div>
      <div class="vm-list">${LP_VIDEOS.map((id, i) => `<button type="button" data-vm="${i}" aria-label="${i + 1}"><img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" loading="lazy" draggable="false"><span>${i + 1}</span></button>`).join('')}</div>
    </div>`
    modal.addEventListener('click', (e) => {
      const t = e.target as Element
      const b = t.closest<HTMLElement>('[data-vm]')
      if (b) return play(Number(b.dataset.vm))
      if (t.closest('.vm-x') || t === modal) close()
    })
    root.appendChild(modal)
    document.documentElement.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    play(n)
  }
  const onClick = (e: Event) => {
    const t = (e.target as Element).closest<HTMLElement>('[data-lp-video]')
    if (!t) return
    e.preventDefault()
    open(Number(card?.dataset.lpVideo ?? t.dataset.lpVideo ?? 0) || 0)
  }
  root.addEventListener('click', onClick)
  return () => {
    window.clearInterval(timer)
    root.removeEventListener('click', onClick)
    close()
  }
}
