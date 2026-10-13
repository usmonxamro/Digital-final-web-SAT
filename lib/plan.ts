/** 30-day free Pro for every account (no payments yet). */
export const TRIAL_DAYS = 30

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

export function trialEndFromNow(): string {
  return new Date(Date.now() + TRIAL_DAYS * 86400_000).toISOString()
}
