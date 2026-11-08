'use client'

import { useEffect, useState } from 'react'
import { setCourseGroups, type CourseGroup } from '@/lib/course-groups'

let cache: CourseGroup[] | null = null
let pending: Promise<CourseGroup[]> | null = null
const listeners = new Set<(g: CourseGroup[]) => void>()

function fetchGroups(): Promise<CourseGroup[]> {
  if (!pending) {
    pending = fetch('/api/course-groups')
      .then((r) => r.json())
      .then((d) => (Array.isArray(d?.groups) ? (d.groups as CourseGroup[]) : []))
      .catch(() => [])
      .then((g) => {
        if (g.length) {
          cache = g
          setCourseGroups(g)
        }
        pending = null
        listeners.forEach((f) => f(cache ?? []))
        return cache ?? []
      })
  }
  return pending
}

/** Call after the admin saved the list, so every open picker shows the new groups. */
export function setCourseGroupsCache(g: CourseGroup[]) {
  cache = g
  setCourseGroups(g)
  listeners.forEach((f) => f(g))
}

/**
 * The course groups (archived ones included — filter with `!g.archived` for pickers).
 * null until loaded.
 */
export function useCourseGroups(): CourseGroup[] | null {
  const [groups, setGroups] = useState<CourseGroup[] | null>(cache)
  useEffect(() => {
    listeners.add(setGroups)
    if (!cache) fetchGroups()
    return () => {
      listeners.delete(setGroups)
    }
  }, [])
  return groups
}
