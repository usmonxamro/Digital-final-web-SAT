'use client'

import { createContext, useContext } from 'react'

export type DashboardUser = {
  id: string
  firstName: string
  lastName?: string
  email?: string | null
  plan?: string
  /** Days left of the free 30-day Pro (null = not on a trial, 0 = ended). */
  trialDaysLeft?: number | null
  /** In a Telegram course group (or admin) — may open My Courses tasks. */
  courseMember?: boolean
  /** Access to every course group (admin / old per-student switch). */
  courseAll?: boolean
  /** Course groups unlocked by a bot code or an admin (slugs, see lib/course-groups.ts). */
  courseGroups?: string[]
}

const UserContext = createContext<DashboardUser | null>(null)

export function UserProvider({
  user,
  children,
}: {
  user: DashboardUser
  children: React.ReactNode
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useUser(): DashboardUser {
  const user = useContext(UserContext)
  if (!user) {
    throw new Error('useUser must be used within the dashboard, inside <UserProvider>.')
  }
  return user
}
