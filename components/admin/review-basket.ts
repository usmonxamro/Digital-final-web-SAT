'use client'

import { useEffect, useState } from 'react'

/** One question picked for a «takrorlash» (review) mock: a bot test's question number, plus its site id when known. */
export type BasketItem = {
  code: string
  name: string
  no: number
  /** Site question id (null = the test exists only in the bot — no text on the site). */
  qid: string | null
  wrongPct?: number
}

const KEY = 'sat-review-basket'
let items: BasketItem[] | null = null
const subs = new Set<(x: BasketItem[]) => void>()

function read(): BasketItem[] {
  if (items) return items
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    items = Array.isArray(raw) ? raw : []
  } catch {
    items = []
  }
  return items!
}
function write(next: BasketItem[]) {
  items = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  subs.forEach((f) => f(next))
}

export const itemKey = (x: Pick<BasketItem, 'code' | 'no'>) => `${x.code}:${x.no}`

export const basket = {
  add(list: BasketItem[]) {
    const cur = read()
    const have = new Map(cur.map((x) => [itemKey(x), x]))
    // Re-adding fills in a site id that was unknown before.
    for (const x of list) have.set(itemKey(x), { ...have.get(itemKey(x)), ...x, qid: x.qid ?? have.get(itemKey(x))?.qid ?? null })
    write([...have.values()])
  },
  remove(keys: string[]) {
    const drop = new Set(keys)
    write(read().filter((x) => !drop.has(itemKey(x))))
  },
  clear() {
    write([])
  },
}

/** The review basket (kept in this browser), live across all views. */
export function useBasket(): BasketItem[] {
  const [v, setV] = useState<BasketItem[]>([])
  useEffect(() => {
    setV(read())
    subs.add(setV)
    return () => {
      subs.delete(setV)
    }
  }, [])
  return v
}

/** "3, 5, 8, 12" — question numbers in increasing order, each once. */
export const numberList = (nos: number[]) => [...new Set(nos)].sort((a, b) => a - b).join(', ')
