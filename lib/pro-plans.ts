/**
 * PRO tariffs sold by card. Prices are in so'm — change them here (both the checkout page and the
 * server read this table; the server never trusts an amount sent by the browser).
 */
export type ProPlan = { id: 'pro-1m' | 'pro-3m'; months: number; price: number; label: string; note?: string }

export const PRO_PLANS: ProPlan[] = [
  { id: 'pro-1m', months: 1, price: 49_000, label: '1 oy' },
  { id: 'pro-3m', months: 3, price: 129_000, label: '3 oy', note: '−12%' },
]

export const planById = (id: unknown): ProPlan | undefined => PRO_PLANS.find((p) => p.id === id)

/** 49000 → "49 000" */
export const formatSom = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ')

/** Which Uzbek card network a number belongs to (by its first digits). */
export type CardBrand = 'uzcard' | 'humo' | 'visa' | 'mastercard' | null
export function cardBrand(digits: string): CardBrand {
  if (/^(8600|5614)/.test(digits)) return 'uzcard'
  if (/^9860/.test(digits)) return 'humo'
  if (/^4/.test(digits)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard'
  return null
}
