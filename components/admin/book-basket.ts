'use client'

import { useEffect, useState } from 'react'

/**
 * Kitob bankidan test tuzish uchun tanlangan savollar («tick qo'yib ketish»).
 * Brauzerda saqlanadi, shuning uchun sahifani varaqlasa, filtrni o'zgartirsa yoki admin panelni
 * yopib qayta ochsa ham tanlov yo'qolmaydi.
 */
export type BookPick = {
  /** question_bank.id */
  id: string
  /** College Board Question ID (kitobdagi ID) */
  sourceId: string
  topic: string
  topicCode: string
  number: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  type: 'mcq' | 'gridin'
  hasImage: boolean
  /** Ro'yxatda ko'rsatish uchun qisqa matn */
  preview: string
  /** Tanlangan vaqt — tartib shu bo'yicha */
  at: number
}

const KEY = 'sat-book-basket'
let items: BookPick[] | null = null
const subs = new Set<(x: BookPick[]) => void>()

function read(): BookPick[] {
  if (items) return items
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    items = Array.isArray(raw) ? (raw as BookPick[]) : []
  } catch {
    items = []
  }
  return items!
}

function write(next: BookPick[]) {
  items = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  subs.forEach((f) => f(next))
}

export const bookBasket = {
  all: () => [...read()],
  has: (id: string) => read().some((x) => x.id === id),
  /** Belgilangan savolni qo'shadi / olib tashlaydi (checkbox). */
  toggle(pick: Omit<BookPick, 'at'>) {
    const cur = read()
    write(cur.some((x) => x.id === pick.id) ? cur.filter((x) => x.id !== pick.id) : [...cur, { ...pick, at: Date.now() }])
  },
  add(list: Omit<BookPick, 'at'>[]) {
    const cur = read()
    const have = new Set(cur.map((x) => x.id))
    const base = Date.now()
    write([...cur, ...list.filter((x) => !have.has(x.id)).map((x, i) => ({ ...x, at: base + i }))])
  },
  remove(ids: string[]) {
    const drop = new Set(ids)
    write(read().filter((x) => !drop.has(x.id)))
  },
  /** Ro'yxatni butunlay almashtirish (tartibni o'zgartirganda). */
  set(list: BookPick[]) {
    write([...list])
  },
  clear() {
    write([])
  },
}

/** Tanlangan kitob savollari (shu brauzerda), barcha ko'rinishlarda bir vaqtda yangilanadi. */
export function useBookBasket(): BookPick[] {
  const [v, setV] = useState<BookPick[]>([])
  useEffect(() => {
    setV(read())
    subs.add(setV)
    return () => {
      subs.delete(setV)
    }
  }, [])
  return v
}
