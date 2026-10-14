/** Free Pro length for accounts created while the launch promotion runs. */
export const TRIAL_DAYS = 30
/**
 * Launch promotion: everyone who joins until this moment gets TRIAL_DAYS of free Pro.
 * Later sign-ups start on FREE (offer Pro separately). Override with env PROMO_UNTIL (ISO date).
 */
export function promoEndsAt(): number {
  const env = process.env.PROMO_UNTIL ? Date.parse(process.env.PROMO_UNTIL) : NaN
  return Number.isFinite(env) ? env : Date.parse('2026-11-14T00:00:00Z')
}
export const promoActive = (): boolean => Date.now() < promoEndsAt()

export type PlanInfo = {
  /** What the app should treat the user as right now. */
  plan: 'premium' | 'free'
  /** Days of the free Pro period left (null when not on a trial). */
  trialDaysLeft: number | null
  premiumUntil: string | null
}

export function planInfo(user: { plan?: string | null; premium_until?: string | null } | null | undefined): PlanInfo {
  if (!user) return { plan: 'free', trialDaysLeft: null, premiumUntil: null }
  if (user.plan === 'premium') return { plan: 'premium', trialDaysLeft: null, premiumUntil: null }
  const until = user.premium_until ? new Date(user.premium_until).getTime() : NaN
  if (Number.isFinite(until) && until > Date.now()) {
    return {
      plan: 'premium',
      trialDaysLeft: Math.max(1, Math.ceil((until - Date.now()) / 86400_000)),
      premiumUntil: user.premium_until ?? null,
    }
  }
  return { plan: 'free', trialDaysLeft: Number.isFinite(until) ? 0 : null, premiumUntil: user.premium_until ?? null }
}

/** End of the free Pro for a new account, or null when the launch promotion is over. */
export function trialEndFromNow(): string | null {
  return promoActive() ? new Date(Date.now() + TRIAL_DAYS * 86400_000).toISOString() : null
}
