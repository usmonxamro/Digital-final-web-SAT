import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession, SESSION_COOKIE } from '@/lib/auth'

/** The exam room is for signed-in students only (questions are also gated by /api/exam/start). */
export default async function ExamLayout({ children }: { children: React.ReactNode }) {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect('/login')
  return children
}
