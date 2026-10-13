import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export const SESSION_COOKIE = 'sat_session'

type SessionPayload = {
  userId: string
  firstName: string
  /** Expiry, ms since epoch. Tokens issued before v38 have none. */
  exp?: number
}

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30
/** Tokens issued before v38 carry no expiry; accept them only until their cookie would have expired anyway. */
const LEGACY_TOKEN_CUTOFF = Date.parse('2026-11-10T00:00:00Z')

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length >= 16) return secret
  // A guessable secret would let anyone forge a login (including an admin's).
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set (or too short) — refusing to sign sessions.')
  }
  return 'dev-only-insecure-secret-change-me'
}

/** HMAC helper for other signed cookies (admin gate, visitor id). */
export function hmac(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE_SEC,
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

/** Signs a compact `payload.signature` token — no external JWT library needed. */
export function signSession(payload: SessionPayload): string {
  const body = base64url(JSON.stringify({ ...payload, exp: payload.exp ?? Date.now() + SESSION_MAX_AGE_SEC * 1000 }))
  const signature = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url')
  return `${body}.${signature}`
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token || token.length > 2048) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  let expected: string
  try {
    expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url')
  } catch {
    return null
  }
  if (!safeEqual(signature, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload?.userId !== 'string') return null
    if (typeof payload.exp === 'number') {
      if (payload.exp < Date.now()) return null
    } else if (Date.now() > LEGACY_TOKEN_CUTOFF) {
      return null // pre-v38 tokens (no expiry) stop working after the cutoff
    }
    return payload
  } catch {
    return null
  }
}
