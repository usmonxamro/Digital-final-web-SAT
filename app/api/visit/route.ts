import { NextRequest, NextResponse } from 'next/server'
import { clientIp, memoryLimit } from '@/lib/rate-limit'
import { addVisit } from '@/lib/site-visits'

/** One call per browser session (see components/visit-ping.tsx). Counts in memory only. */
export async function POST(req: NextRequest) {
  if (memoryLimit(`visit:${clientIp(req)}`, 20, 10 * 60_000)) addVisit()
  return new NextResponse(null, { status: 204 })
}
