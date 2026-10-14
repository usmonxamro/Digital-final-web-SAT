import crypto from 'crypto'
import { hmac } from '@/lib/auth'

export const RESET_MINUTES = 15
export const RESET_MAX_TRIES = 5

export function newResetCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

/** Codes are stored hashed (bound to the user id), never in clear text. */
export function hashResetCode(userId: string, code: string): string {
  return hmac(`reset:${userId}:${code}`)
}
