import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

/** Lets the exam page know whether the "Check it now" preview tools may be shown. */
export async function GET() {
  try {
    await requireAdmin()
    return NextResponse.json({ admin: true })
  } catch {
    return NextResponse.json({ admin: false })
  }
}
