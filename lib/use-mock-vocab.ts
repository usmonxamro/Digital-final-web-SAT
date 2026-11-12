'use client'

import { useEffect, useState } from 'react'
import type { VocabEntry } from '@/lib/question-vocab'

export type VocabMap = Record<string, VocabEntry[]>

const cache = new Map<string, Promise<VocabMap>>()

/** One tiny request per mock (shared by the review screen and the PDF button); never part of the exam payload. */
export function fetchMockVocab(label: string): Promise<VocabMap> {
  let p = cache.get(label)
  if (!p) {
    p = fetch(`/api/mock-vocab?label=${encodeURIComponent(label)}`)
      .then((r) => (r.ok ? r.json() : { vocab: {} }))
      .then((d) => (d?.vocab ?? {}) as VocabMap)
      .catch(() => ({}) as VocabMap)
    cache.set(label, p)
  }
  return p
}

/** Loads the vocabulary only once `enabled` turns true (e.g. when the student opens the first question). */
export function useMockVocab(label: string | undefined, enabled: boolean): VocabMap {
  const [map, setMap] = useState<VocabMap>({})
  useEffect(() => {
    if (!enabled || !label) return
    let alive = true
    fetchMockVocab(label).then((m) => alive && setMap(m))
    return () => {
      alive = false
    }
  }, [label, enabled])
  return map
}
