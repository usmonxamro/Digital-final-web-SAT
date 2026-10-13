/** Extracts the 11-character YouTube video id from any common link form (or a bare id). */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  let url: URL
  try {
    url = new URL(s.startsWith('http') ? s : `https://${s}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    id = url.searchParams.get('v')
    if (!id) {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/)
      id = m?.[1] ?? null
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

/**
 * Light obfuscation for the id in transit (per-response random key), so it
 * doesn't sit in the network tab as a copy-pasteable YouTube link. Not
 * encryption — the browser has to decode it to play the video.
 */
export function maskId(id: string): { k: string; v: string } {
  const key = Array.from({ length: id.length }, () => Math.floor(Math.random() * 64))
  const v = Array.from(id, (ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ key[i])).join('')
  return {
    k: key.map((n) => n.toString(36).padStart(2, '0')).join(''),
    v: Buffer.from(v, 'latin1').toString('base64'),
  }
}

export function unmaskId(m: { k: string; v: string }): string {
  const key = m.k.match(/.{2}/g)!.map((x) => parseInt(x, 36))
  const raw = atob(m.v)
  return Array.from(raw, (ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ key[i])).join('')
}
