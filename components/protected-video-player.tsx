'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Gauge, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react'

/* ------------------------- YouTube IFrame API types ------------------------ */
type YTPlayer = {
  playVideo(): void
  pauseVideo(): void
  seekTo(s: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getVideoLoadedFraction(): number
  getPlayerState(): number
  setPlaybackRate(r: number): void
  mute(): void
  unMute(): void
  isMuted(): boolean
  setVolume(v: number): void
  getVolume(): number
  destroy(): void
}
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: Record<string, number> }
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<void> | null = null
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    document.head.appendChild(s)
  })
  return apiPromise
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]
const fmt = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Plays a YouTube video inside our own player:
 *  - YouTube's own controls, title, logo, "Watch on YouTube", share and
 *    end-screen suggestions are hidden or covered — nothing in the frame is
 *    clickable, so there is no way to jump to the video on YouTube;
 *  - our controls drive the video through the IFrame API;
 *  - a faint moving watermark with the viewer's name discourages screen
 *    recording and re-sharing.
 */
export function ProtectedVideoPlayer({
  videoId,
  title,
  watermark,
}: {
  videoId: string
  title: string
  watermark?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [started, setStarted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(100)
  const [speed, setSpeed] = useState(1)
  const [speedOpen, setSpeedOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  // iOS/Android sometimes refuse play() from outside the frame — then the
  // next tap goes to the frame itself once.
  const [directTap, setDirectTap] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [wmPos, setWmPos] = useState({ x: 12, y: 16 })

  /* --------------------------------- player -------------------------------- */
  useEffect(() => {
    let cancelled = false
    loadYouTubeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT) return
      // The API replaces its target node with an <iframe>, so give it a node
      // React doesn't own.
      const target = document.createElement('div')
      mountRef.current.replaceChildren(target)
      playerRef.current = new window.YT.Player(target, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          cc_load_policy: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled) return
            setReady(true)
            setDuration(playerRef.current?.getDuration() ?? 0)
          },
          onStateChange: (e: { data: number }) => {
            const S = window.YT!.PlayerState
            setPlaying(e.data === S.PLAYING)
            setEnded(e.data === S.ENDED)
            if (e.data === S.PLAYING) {
              setStarted(true)
              setDirectTap(false)
              setDuration(playerRef.current?.getDuration() ?? 0)
            }
          },
        },
      })
    })
    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
      mountRef.current?.replaceChildren()
    }
  }, [videoId])

  // Progress polling while playing.
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      const p = playerRef.current
      if (!p) return
      setTime(p.getCurrentTime())
      setBuffered(p.getVideoLoadedFraction())
    }, 250)
    return () => clearInterval(t)
  }, [playing])

  // Watermark drifts to a new spot every few seconds.
  useEffect(() => {
    if (!watermark) return
    const t = setInterval(() => setWmPos({ x: 6 + Math.random() * 60, y: 10 + Math.random() * 70 }), 7000)
    return () => clearInterval(t)
  }, [watermark])

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrapRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  /* -------------------------------- actions -------------------------------- */
  const toggle = useCallback(() => {
    const p = playerRef.current
    if (!p || !ready) return
    if (playing) p.pauseVideo()
    else {
      if (ended) p.seekTo(0, true)
      p.playVideo()
      // Mobile browsers may block play() coming from outside the frame.
      setTimeout(() => {
        if (window.YT && playerRef.current?.getPlayerState() !== window.YT.PlayerState.PLAYING) setDirectTap(true)
      }, 1200)
    }
  }, [playing, ready, ended])

  const seekBy = useCallback((d: number) => {
    const p = playerRef.current
    if (!p) return
    const t = Math.min(Math.max(0, p.getCurrentTime() + d), p.getDuration() || Infinity)
    p.seekTo(t, true)
    setTime(t)
  }, [])

  function seekTo(frac: number) {
    const p = playerRef.current
    if (!p || !duration) return
    const t = frac * duration
    p.seekTo(t, true)
    setTime(t)
  }

  function setRate(r: number) {
    playerRef.current?.setPlaybackRate(r)
    setSpeed(r)
    setSpeedOpen(false)
  }

  function toggleMute() {
    const p = playerRef.current
    if (!p) return
    if (p.isMuted()) {
      p.unMute()
      setMuted(false)
    } else {
      p.mute()
      setMuted(true)
    }
  }

  function changeVolume(v: number) {
    const p = playerRef.current
    if (!p) return
    p.setVolume(v)
    setVolume(v)
    if (v > 0 && p.isMuted()) {
      p.unMute()
      setMuted(false)
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else wrapRef.current?.requestFullscreen?.().catch(() => {})
  }

  function poke() {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2600)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault()
      toggle()
    } else if (e.key === 'ArrowRight') seekBy(5)
    else if (e.key === 'ArrowLeft') seekBy(-5)
    else if (e.key === 'f') toggleFullscreen()
    else if (e.key === 'm') toggleMute()
    poke()
  }

  const showChrome = !playing || controlsVisible
  const progress = duration ? (time / duration) * 100 : 0

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={poke}
      onContextMenu={(e) => e.preventDefault()}
      className={`group relative w-full select-none overflow-hidden bg-black outline-none ${
        fullscreen ? 'h-full' : 'aspect-video rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]'
      } ${playing && !controlsVisible ? 'cursor-none' : ''}`}
    >
      {/* The YouTube frame — scaled a bit so its edge UI sits outside the box */}
      <div className="pointer-events-none absolute inset-[-1px] scale-[1.02]">
        <div ref={mountRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
      </div>

      {/* Click shield: nothing inside the frame can be clicked. */}
      <div
        className={`absolute inset-0 ${directTap ? 'pointer-events-none' : ''}`}
        onClick={() => {
          toggle()
          poke()
        }}
        onDoubleClick={toggleFullscreen}
      />

      {/* Covers YouTube's title bar while paused, with our own title. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(0,0,0,0.92),rgba(0,0,0,0.6)_55%,transparent)] px-4 pt-3 transition-opacity duration-300 sm:px-5 ${
          !playing ? 'opacity-100' : showChrome ? 'opacity-90' : 'opacity-0'
        }`}
      >
        <div className="truncate text-[13.5px] font-bold text-white sm:text-[15px]">{title}</div>
        <div className="text-[11px] font-semibold text-white/60">Video tahlil</div>
      </div>

      {/* Watermark */}
      {watermark && (
        <div
          className="pointer-events-none absolute text-[11px] font-semibold text-white/[0.16] transition-all duration-[2000ms] sm:text-[12px]"
          style={{ left: `${wmPos.x}%`, top: `${wmPos.y}%` }}
        >
          {watermark}
        </div>
      )}

      {/* Big play button / loading / end screen — fully covers the frame */}
      {(!started || ended || !ready) && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${
            ended ? 'bg-black/90' : started ? '' : 'bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.35),rgba(0,0,0,0.85))]'
          } ${directTap ? 'pointer-events-none' : ''}`}
          onClick={toggle}
        >
          {!ready ? (
            <span className="size-10 animate-spin rounded-full border-[3px] border-white/70 border-t-transparent" />
          ) : (
            <>
              <span className="flex size-16 items-center justify-center rounded-full bg-[#FF6600] text-white shadow-[0_8px_30px_rgba(255,102,0,0.5)] transition-transform hover:scale-105 sm:size-20">
                {ended ? <RotateCcw className="size-7 sm:size-8" /> : <Play className="ml-1 size-7 fill-current sm:size-9" />}
              </span>
              <span className="text-[13px] font-semibold text-white/85">
                {ended ? 'Qayta ko‘rish' : directTap ? 'Videoni boshlash uchun yana bir marta bosing' : 'Tahlilni boshlash'}
              </span>
            </>
          )}
        </div>
      )}

      {/* Paused overlay icon (middle) */}
      {started && !playing && !ended && ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-black/55 text-white">
            <Play className="ml-0.5 size-6 fill-current" />
          </span>
        </div>
      )}

      {/* Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.9),rgba(0,0,0,0.55)_60%,transparent)] px-3 pb-2.5 pt-8 transition-opacity duration-300 sm:px-4 ${
          started && showChrome ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress */}
        <div
          className="group/bar relative mb-2 h-4 cursor-pointer"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            seekTo(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/bar:h-1.5">
            <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${buffered * 100}%` }} />
            <div className="absolute inset-y-0 left-0 bg-[#FF6600]" style={{ width: `${progress}%` }} />
          </div>
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF6600] opacity-0 shadow transition-opacity group-hover/bar:opacity-100"
            style={{ left: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-1 text-white sm:gap-2">
          <CtrlBtn label={playing ? 'Pauza' : 'Davom etish'} onClick={toggle}>
            {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
          </CtrlBtn>
          <CtrlBtn label="10 soniya orqaga" onClick={() => seekBy(-10)}>
            <RotateCcw className="size-[18px]" />
          </CtrlBtn>
          <CtrlBtn label="10 soniya oldinga" onClick={() => seekBy(10)}>
            <RotateCw className="size-[18px]" />
          </CtrlBtn>
          <div className="hidden items-center gap-1 sm:flex">
            <CtrlBtn label={muted ? 'Ovozni yoqish' : "Ovozni o'chirish"} onClick={toggleMute}>
              {muted || volume === 0 ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
            </CtrlBtn>
            <input
              type="range"
              min={0}
              max={100}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Ovoz balandligi"
              className="h-1 w-20 cursor-pointer accent-[#FF6600]"
            />
          </div>
          <span className="ml-1 text-[12px] font-semibold tabular-nums text-white/85 sm:text-[12.5px]">
            {fmt(time)} / {fmt(duration)}
          </span>

          <div className="relative ml-auto">
            <CtrlBtn label="Tezlik" onClick={() => setSpeedOpen((v) => !v)}>
              <span className="flex items-center gap-1 text-[12px] font-bold">
                <Gauge className="size-[17px]" /> {speed}x
              </span>
            </CtrlBtn>
            {speedOpen && (
              <div className="absolute bottom-10 right-0 min-w-[92px] overflow-hidden rounded-lg bg-[#111]/95 py-1 shadow-xl ring-1 ring-white/10">
                {SPEEDS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRate(r)}
                    className={`block w-full px-3 py-1.5 text-left text-[12.5px] font-semibold hover:bg-white/10 ${
                      r === speed ? 'text-[#FF8a33]' : 'text-white'
                    }`}
                  >
                    {r === 1 ? 'Oddiy' : `${r}x`}
                  </button>
                ))}
              </div>
            )}
          </div>
          <CtrlBtn label={fullscreen ? "To'liq ekrandan chiqish" : "To'liq ekran"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
          </CtrlBtn>
        </div>
      </div>
    </div>
  )
}

function CtrlBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 min-w-9 items-center justify-center rounded-md px-1.5 transition-colors hover:bg-white/15"
    >
      {children}
    </button>
  )
}
